import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AssetMarket } from '../../shared/enums';
import { AnalysisService } from '../analysis/analysis.service';
import { AiRouterService } from '../ai-router/ai-router.service';
import { MacroArService } from '../ingestion/macro/macro-ar.service';
import { RedisPriceService } from '../ingestion/cache/redis-price.service';
import { ScoreCalculatorService } from '../sentiment/score-calculator.service';
import { SuggestionsService } from './suggestions.service';
import { SuggestionChat, SuggestionChatRole } from './entities/suggestion-chat.entity';

export interface ChatMessage {
  id: string;
  sessionId: string;
  symbol: string | null;
  market: AssetMarket | null;
  role: SuggestionChatRole;
  content: string;
  tokensUsed: number;
  createdAt: Date;
}

@Injectable()
export class SuggestionBotService {
  private readonly logger = new Logger(SuggestionBotService.name);
  private readonly systemPrompt = `Sos Aurora, un asistente de analisis financiero especializado en mercados cripto y argentinos.
Tu rol es ayudar al usuario a entender las sugerencias de inversion generadas por el sistema.

REGLAS IMPORTANTES:
- Respondes siempre en espanol rioplatense
- Nunca das consejos de inversion directos ("deberias comprar X")
- Siempre contextualizas con los datos del sistema
- Si no tenes datos de un activo, lo decis
- Sos conciso: maximo 3 parrafos por respuesta
- Aclaras que el analisis no es recomendacion de inversion cuando el usuario pregunta que comprar directamente

CAPACIDADES:
- Explicar por que un activo aparece en sugerencias
- Describir las senales activas (tecnico, social, smart money, fundamentals)
- Comparar dos activos entre si
- Explicar conceptos financieros en simple
- Responder sobre contexto macro argentino
- Analizar el perfil de riesgo de una sugerencia`;

  constructor(
    private readonly aiRouterService: AiRouterService,
    private readonly suggestionsService: SuggestionsService,
    private readonly analysisService: AnalysisService,
    private readonly scoreCalculatorService: ScoreCalculatorService,
    private readonly redisPriceService: RedisPriceService,
    private readonly macroArService: MacroArService,
    @InjectRepository(SuggestionChat)
    private readonly suggestionChatRepository: Repository<SuggestionChat>,
  ) {}

  async buildContext(symbol?: string, market?: AssetMarket): Promise<string> {
    if (!symbol || !market) {
      return '';
    }

    const normalizedSymbol = symbol.trim().toUpperCase();
    const safe = async <T>(factory: () => Promise<T>): Promise<T | null> => {
      try {
        return await factory();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        this.logger.warn(`No se pudo construir parte del contexto para ${normalizedSymbol}: ${message}`);
        return null;
      }
    };

    const [suggestion, analysis, sentiment, livePrice, macroContext] = await Promise.all([
      safe(() => this.suggestionsService.getSuggestionDetail(normalizedSymbol, market)),
      safe(() => this.analysisService.analyzeAsset(normalizedSymbol, market)),
      safe(() => this.scoreCalculatorService.buildSentimentResult(normalizedSymbol, market)),
      safe(() => this.redisPriceService.getPrice(normalizedSymbol, market)),
      market === AssetMarket.STOCK_AR ? safe(() => this.macroArService.getMacroContext()) : Promise.resolve(null),
    ]);

    const contextPayload = {
      symbol: normalizedSymbol,
      market,
      suggestion,
      analysis,
      sentiment,
      livePrice,
      macroContext,
    };

    return `CONTEXTO DEL SISTEMA:\n${JSON.stringify(contextPayload)}`;
  }

  async chat(
    userId: string,
    sessionId: string,
    message: string,
    symbol?: string,
    market?: AssetMarket,
  ): Promise<{ response: string; tokensUsed: number }> {
    const trimmedMessage = message.trim();
    const normalizedSymbol = symbol?.trim().toUpperCase() ?? null;
    const history = await this.suggestionChatRepository.find({
      where: { userId, sessionId },
      order: { createdAt: 'ASC' },
      take: 10,
    });
    const recentHistory = history.slice(-8);
    const context = await this.buildContext(normalizedSymbol ?? undefined, market);
    const historyPrompt = recentHistory.length > 0
      ? `\nHISTORIAL RECIENTE DE LA SESION:\n${recentHistory
        .map((entry) => `${entry.role === SuggestionChatRole.USER ? 'Usuario' : 'Aurora'}: ${entry.content}`)
        .join('\n')}`
      : '';

    let responseContent = '';
    let tokensUsed = 0;

    const userMessage = this.suggestionChatRepository.create({
      userId,
      sessionId,
      symbol: normalizedSymbol,
      market: market ?? null,
      role: SuggestionChatRole.USER,
      content: trimmedMessage,
      tokensUsed: 0,
    });

    try {
      const response = await this.aiRouterService.route({
        taskType: 'CHAT',
        prompt: `${historyPrompt}\n\nMENSAJE ACTUAL DEL USUARIO:\n${trimmedMessage}`,
        systemPrompt: `${this.systemPrompt}${context ? `\n\n${context}` : ''}\n\nResponde usando primero los datos del sistema y, si faltan, aclaralo explicitamente.`,
        userId,
        sessionId,
      });

      responseContent = response.content.trim();
      tokensUsed = response.tokensInput + response.tokensOutput;

      const assistantMessage = this.suggestionChatRepository.create({
        userId,
        sessionId,
        symbol: normalizedSymbol,
        market: market ?? null,
        role: SuggestionChatRole.ASSISTANT,
        content: responseContent,
        tokensUsed,
      });

      await this.suggestionChatRepository.save([userMessage, assistantMessage]);
      return {
        response: assistantMessage.content,
        tokensUsed,
      };
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`SugBot no disponible: ${rawMessage}`);

      const fallbackResponse = await this.buildLocalFallback(trimmedMessage, normalizedSymbol, market);
      responseContent = fallbackResponse
        ? `${fallbackResponse}\n\nNota: la capa de IA externa no estuvo disponible en este intento, así que respondí con datos locales del sistema.`
        : 'Aurora no está disponible ahora mismo. Verificá tu configuración (GEMINI/OpenAI/Anthropic) y probá de nuevo en unos minutos.';

      const assistantMessage = this.suggestionChatRepository.create({
        userId,
        sessionId,
        symbol: normalizedSymbol,
        market: market ?? null,
        role: SuggestionChatRole.ASSISTANT,
        content: responseContent,
        tokensUsed: 0,
      });

      await this.suggestionChatRepository.save([userMessage, assistantMessage]);

      return {
        response: responseContent,
        tokensUsed: 0,
      };
    }
  }

  async getHistory(userId: string, sessionId: string): Promise<ChatMessage[]> {
    const messages = await this.suggestionChatRepository.find({
      where: { userId, sessionId },
      order: { createdAt: 'ASC' },
    });

    return messages.map((message) => ({
      id: message.id,
      sessionId: message.sessionId,
      symbol: message.symbol,
      market: message.market,
      role: message.role,
      content: message.content,
      tokensUsed: message.tokensUsed,
      createdAt: message.createdAt,
    }));
  }

  async clearSession(userId: string, sessionId: string): Promise<void> {
    await this.suggestionChatRepository.delete({ userId, sessionId });
  }

  private async buildLocalFallback(
    message: string,
    symbol?: string | null,
    market?: AssetMarket,
  ): Promise<string | null> {
    const normalizedMessage = this.normalizeText(message);

    if (!symbol || !market) {
      return this.buildGeneralFallback(normalizedMessage);
    }

    const suggestionDetail = await this.suggestionsService.getSuggestionDetail(symbol, market);
    if (!suggestionDetail) {
      return this.buildGeneralFallback(normalizedMessage);
    }

    if (this.matchesAny(normalizedMessage, ['riesgo', 'riesgos'])) {
      const risks = suggestionDetail.risks.length > 0
        ? suggestionDetail.risks.join('; ')
        : 'No hay riesgos detallados cargados para este activo.';

      return `Los principales riesgos de ${symbol} hoy son: ${risks}\n\nEn la sugerencia figura con riesgo ${suggestionDetail.riskLevel} y un score de convicción de ${suggestionDetail.convictionScore.toFixed(2)}.`;
    }

    if (this.matchesAny(normalizedMessage, ['senal', 'senales', 'explicame'])) {
      const signals = suggestionDetail.signals;
      return `Las señales de ${symbol} muestran este cuadro: social ${signals.social.score}, técnico ${signals.technical.score}, smart money ${signals.smartMoney.score}, listing ${signals.listing.score}, fundamental ${signals.fundamental.score} y macro ${signals.macro.score}.\n\nA eso se suma una categoría ${suggestionDetail.category}, horizonte ${suggestionDetail.timeHorizon} y riesgo ${suggestionDetail.riskLevel}.`;
    }

    if (this.matchesAny(normalizedMessage, ['por que', 'porque', 'aparece', 'sugerencia', 'sugerencias'])) {
      const catalysts = suggestionDetail.catalysts.length > 0
        ? suggestionDetail.catalysts.join('; ')
        : 'No hay catalizadores específicos cargados.';

      return `${symbol} aparece en sugerencias porque su score de convicción actual es ${suggestionDetail.convictionScore.toFixed(2)} y quedó clasificado en ${suggestionDetail.category}.\n\nLos catalizadores registrados son: ${catalysts}`;
    }

    if (this.matchesAny(normalizedMessage, ['entrada', 'entrar', 'comprar', 'conviene'])) {
      return `No doy una orden de compra o venta directa, pero sí te puedo resumir el contexto de ${symbol}: convicción ${suggestionDetail.convictionScore.toFixed(2)}, riesgo ${suggestionDetail.riskLevel} y horizonte ${suggestionDetail.timeHorizon}.\n\nDescripción del sistema: ${suggestionDetail.narrative}`;
    }

    return `Puedo ayudarte con ${symbol} usando los datos locales disponibles. Hoy figura con convicción ${suggestionDetail.convictionScore.toFixed(2)}, categoría ${suggestionDetail.category} y riesgo ${suggestionDetail.riskLevel}.\n\nDescripción: ${suggestionDetail.narrative}`;
  }

  private buildGeneralFallback(normalizedMessage: string): string {
    if (this.matchesAny(normalizedMessage, ['limitacion', 'limitaciones', 'funcion', 'funciones', 'que podes hacer', 'que puedes hacer'])) {
      return 'Mi función es ayudarte a interpretar activos, señales, riesgos, contexto macro y sugerencias del sistema Aurora.\n\nMis limitaciones son claras: no ejecuto órdenes, no reemplazo criterio profesional y, si falla la capa de IA externa, sólo puedo responder con los datos locales que ya tenga cargados la plataforma.';
    }

    if (this.matchesAny(normalizedMessage, ['hola', 'buenas', 'buen dia'])) {
      return 'Puedo ayudarte a revisar sugerencias, explicar señales, resumir riesgos y darte contexto de un activo puntual si me indicás el símbolo.\n\nSi querés una respuesta más precisa, escribime el activo y la pregunta concreta.';
    }

    return 'Ahora mismo la capa de IA externa no respondió, pero sigo disponible para consultas apoyadas en datos locales del sistema.\n\nPodés preguntarme por un símbolo puntual, por riesgos, señales, convicción o por el funcionamiento general de Aurora.';
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private matchesAny(text: string, patterns: string[]): boolean {
    return patterns.some((pattern) => text.includes(pattern));
  }
}
