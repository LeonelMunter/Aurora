import { Injectable, Logger } from '@nestjs/common';

import { AssetMarket } from '../../shared/enums';
import { AnalysisService } from '../analysis/analysis.service';
import { TechnicalAnalysis } from '../analysis/analysis.types';
import { AiRouterService } from '../ai-router/ai-router.service';
import { MacroArService } from '../ingestion/macro/macro-ar.service';
import { StrategyService } from '../strategy/strategy.service';
import { StrategyRecommendation } from '../strategy/strategy.types';
import { ASSET_NAMES } from './asset-universe';
import { Suggestion } from './entities/suggestion.entity';
import { FundamentalSignalService } from './signals/fundamental-signal.service';
import { ListingSignalService } from './signals/listing-signal.service';
import { SmartMoneyService } from './signals/smart-money.service';
import { SocialSignalService } from './signals/social-signal.service';
import {
  FundamentalSignal,
  MacroSignal,
  RiskLevel,
  SignalBreakdown,
  SocialSignal,
  SuggestionCategory,
  TechnicalSignal,
  TimeHorizon,
} from './suggestions.types';

@Injectable()
export class ConvictionEngineService {
  private readonly logger = new Logger(ConvictionEngineService.name);

  constructor(
    private readonly socialSignalService: SocialSignalService,
    private readonly analysisService: AnalysisService,
    private readonly strategyService: StrategyService,
    private readonly smartMoneyService: SmartMoneyService,
    private readonly listingSignalService: ListingSignalService,
    private readonly fundamentalSignalService: FundamentalSignalService,
    private readonly macroArService: MacroArService,
    private readonly aiRouterService: AiRouterService,
  ) {}

  async calculateConviction(symbol: string, market: AssetMarket): Promise<Partial<Suggestion>> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const settled = await Promise.allSettled([
      this.socialSignalService.getScore(normalizedSymbol, market),
      this.analysisService.analyzeAsset(normalizedSymbol, market),
      this.strategyService.recommendAsset(normalizedSymbol, market),
      this.smartMoneyService.getScore(normalizedSymbol, market),
      this.listingSignalService.getScore(normalizedSymbol, market),
      this.fundamentalSignalService.getScore(normalizedSymbol, market),
      this.macroArService.getMacroContext(),
    ]);

    const social = this.getSettled(settled[0], {
      score: 50,
      trend: 'STABLE',
      mentions: 0,
    } as SocialSignal);
    const analysis = this.getSettled<TechnicalAnalysis | null>(settled[1], null);
    const strategy = this.getSettled<StrategyRecommendation | null>(settled[2], null);
    const smartMoney = this.getSettled(settled[3], {
      score: 50,
      whaleActivity: 'UNAVAILABLE',
      unusualVolume: false,
    });
    const listing = this.getSettled(settled[4], {
      score: 50,
      isNew: false,
      listingDate: null,
    });
    const fundamental = this.getSettled(settled[5], {
      score: 50,
      marketCap: null,
      githubActivity: null,
    } as FundamentalSignal);
    const macroSignal = this.buildMacroSignal(this.getSettled(settled[6], 'Contexto macro no disponible.'));
    const technical = this.buildTechnicalSignal(analysis, strategy);

    const signals: SignalBreakdown = {
      social: {
        score: social.score,
        trend: social.trend,
        mentions: social.mentions,
      },
      technical: {
        score: technical.score,
        rsi: technical.rsi,
        trend: technical.trend,
        volume: technical.volume,
      },
      smartMoney: {
        score: smartMoney.score,
        whaleActivity: smartMoney.whaleActivity,
        unusualVolume: smartMoney.unusualVolume,
      },
      listing: {
        score: listing.score,
        isNew: listing.isNew,
        listingDate: listing.listingDate,
      },
      fundamental: {
        score: fundamental.score,
        marketCap: fundamental.marketCap,
        githubActivity: fundamental.githubActivity,
      },
      macro: macroSignal,
    };

    const convictionScore = this.round(
      (signals.social.score * 0.25) +
      (signals.technical.score * 0.3) +
      (signals.smartMoney.score * 0.2) +
      (signals.listing.score * 0.1) +
      (signals.fundamental.score * 0.1) +
      (signals.macro.score * 0.05),
    );

    const category = this.resolveCategory(signals);
    const riskLevel = this.resolveRiskLevel(market, category, signals, technical);
    const timeHorizon = this.resolveTimeHorizon(category);
    const catalysts = this.buildCatalysts(signals, technical).slice(0, 5);
    const risks = this.buildRisks(market, signals, technical).slice(0, 3);
    const calculatedAt = new Date();
    const narrative = await this.generateNarrative(normalizedSymbol, market, signals, catalysts, risks);

    return {
      symbol: normalizedSymbol,
      market,
      name: ASSET_NAMES[normalizedSymbol] ?? normalizedSymbol,
      convictionScore,
      category,
      timeHorizon,
      riskLevel,
      signals,
      narrative,
      catalysts,
      risks,
      priceAtAnalysis: analysis?.lastPrice ?? strategy?.entryPrice ?? null,
      targetPrice: strategy?.targetPrice ?? null,
      stopLoss: strategy?.stopLoss ?? null,
      isActive: convictionScore >= 45,
      expiresAt: new Date(calculatedAt.getTime() + (4 * 60 * 60 * 1000)),
      calculatedAt,
    };
  }

  async generateNarrative(
    symbol: string,
    market: AssetMarket,
    signals: SignalBreakdown,
    catalysts: string[],
    risks: string[],
  ): Promise<string> {
    try {
      const response = await this.aiRouterService.route({
        taskType: 'FULL_ANALYSIS',
        systemPrompt: 'Sos un analista financiero experto en mercados cripto y argentinos. Escribís análisis concisos, objetivos y en español rioplatense. Nunca das consejos de inversión directos. Siempre aclarás que es solo análisis.',
        prompt: `Generá un análisis de 150-200 palabras para ${symbol} (${market}) basado en estas señales:\n${JSON.stringify({ signals, catalysts, risks })}\nIncluí: contexto actual, por qué aparece como sugerencia, catalizadores clave y riesgos principales. Escribí en segunda persona ("el activo muestra", "se observa").`,
      });

      return response.content.trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`Narrativa IA no disponible para ${symbol}: ${message}`);
      return `El activo muestra una combinación de señales que justifican su seguimiento en este momento. El score de convicción integra momentum social, lectura técnica, actividad de smart money, posibles catalizadores de listado, fundamentos y contexto macro. Se observa una tesis apoyada por ${catalysts.slice(0, 2).join(' y ') || 'señales mixtas'}, aunque también persisten riesgos como ${risks.slice(0, 2).join(' y ') || 'volatilidad de mercado'}. Este texto es solo análisis y no constituye una recomendación de inversión.`;
    }
  }

  private buildTechnicalSignal(
    analysis: TechnicalAnalysis | null,
    strategy: StrategyRecommendation | null,
  ): TechnicalSignal {
    if (!analysis) {
      return {
        score: 50,
        rsi: 50,
        trend: 'LATERAL',
        volume: 'NORMAL',
        atrPct: null,
      };
    }

    let score = strategy?.topStrategy.score ?? 50;
    if (analysis.rsi.signal === 'OVERSOLD') {
      score += 10;
    }
    if (analysis.macd.trend === 'BULLISH') {
      score += 10;
    }
    if (analysis.trend.direction === 'DOWN') {
      score -= 10;
    }

    const relativeVolume = analysis.volume.relativeVolume ?? 1;
    const volume = relativeVolume > 2 ? 'EXTREME'
      : relativeVolume > 1.3 ? 'HIGH'
        : relativeVolume < 0.8 ? 'LOW'
          : 'NORMAL';
    const atrPct = analysis.atr.value !== null && analysis.lastPrice > 0
      ? this.round((analysis.atr.value / analysis.lastPrice) * 100)
      : null;

    return {
      score: this.clamp(score),
      rsi: analysis.rsi.value ?? 50,
      trend: analysis.trend.direction,
      volume,
      atrPct,
    };
  }

  private buildMacroSignal(context: string): MacroSignal {
    const lower = context.toLowerCase();
    let score = 50;
    if (/(brecha|devaluacion|incertidumbre|riesgo soberano)/.test(lower)) {
      score -= 10;
    }
    if (/(inflacion alta|dolarizados|refugio|mep)/.test(lower)) {
      score += 5;
    }
    return {
      score: this.clamp(score),
      context,
    };
  }

  private resolveCategory(signals: SignalBreakdown): SuggestionCategory {
    if (signals.listing.isNew) {
      return SuggestionCategory.LISTING_SOON;
    }
    if (signals.technical.trend === 'DOWN' && signals.social.trend === 'RISING') {
      return SuggestionCategory.RECOVERY;
    }
    if (signals.technical.score > 70 && signals.social.score < 40) {
      return SuggestionCategory.TECHNICAL_SETUP;
    }
    if ((signals.fundamental.marketCap ?? 0) > 10000000000) {
      return SuggestionCategory.ESTABLISHED;
    }
    if ((signals.fundamental.marketCap ?? Number.MAX_SAFE_INTEGER) < 500000000) {
      return SuggestionCategory.EMERGING;
    }
    if (/(refugio|mep|ccl|dolarizados|brecha)/i.test(signals.macro.context)) {
      return SuggestionCategory.MACRO_DRIVEN;
    }
    return SuggestionCategory.ESTABLISHED;
  }

  private resolveRiskLevel(
    market: AssetMarket,
    category: SuggestionCategory,
    signals: SignalBreakdown,
    technical: TechnicalSignal,
  ): RiskLevel {
    if (signals.listing.isNew) {
      return (signals.fundamental.marketCap ?? 0) < 100000000 ? RiskLevel.VERY_HIGH : RiskLevel.HIGH;
    }
    if ((signals.fundamental.marketCap ?? 0) > 10000000000) {
      return technical.atrPct !== null && technical.atrPct > 5 ? RiskLevel.MEDIUM : RiskLevel.LOW;
    }
    if (market === AssetMarket.BOND) {
      return signals.fundamental.score >= 70 ? RiskLevel.LOW : RiskLevel.MEDIUM;
    }
    if (category === SuggestionCategory.EMERGING) {
      return RiskLevel.HIGH;
    }
    if (technical.atrPct !== null && technical.atrPct > 6) {
      return RiskLevel.HIGH;
    }
    if (technical.atrPct !== null && technical.atrPct > 3) {
      return RiskLevel.MEDIUM;
    }
    return RiskLevel.LOW;
  }

  private resolveTimeHorizon(category: SuggestionCategory): TimeHorizon {
    if (category === SuggestionCategory.LISTING_SOON || category === SuggestionCategory.TECHNICAL_SETUP) {
      return TimeHorizon.SHORT_TERM;
    }
    if (category === SuggestionCategory.RECOVERY) {
      return TimeHorizon.MEDIUM_TERM;
    }
    if (category === SuggestionCategory.ESTABLISHED) {
      return TimeHorizon.LONG_TERM;
    }
    return TimeHorizon.MEDIUM_TERM;
  }

  private buildCatalysts(signals: SignalBreakdown, technical: TechnicalSignal): string[] {
    const catalysts: string[] = [];
    if (technical.rsi > 0 && technical.rsi < 30) {
      catalysts.push(`RSI en sobreventa (${technical.rsi}) - posible rebote`);
    }
    if (signals.smartMoney.unusualVolume) {
      catalysts.push(`Volumen inusual detectado (${signals.technical.volume})`);
    }
    if (signals.listing.isNew) {
      catalysts.push('Nuevo listing o descubrimiento reciente con visibilidad creciente');
    }
    if (signals.smartMoney.whaleActivity === 'BUYING') {
      catalysts.push('Whale accumulation detectada en las últimas 24h');
    }
    if (signals.social.trend === 'RISING') {
      catalysts.push(`Sentimiento social creciendo con ${signals.social.mentions} menciones recientes`);
    }
    if (signals.fundamental.marketCap !== null && signals.fundamental.marketCap > 10000000000) {
      catalysts.push('Capitalización elevada que reduce riesgo estructural');
    }
    return catalysts;
  }

  private buildRisks(
    market: AssetMarket,
    signals: SignalBreakdown,
    technical: TechnicalSignal,
  ): string[] {
    const risks: string[] = [];
    if (technical.atrPct !== null && technical.atrPct > 5) {
      risks.push(`Alta volatilidad (ATR ${technical.atrPct}%)`);
    }
    if ((signals.fundamental.marketCap ?? Number.MAX_SAFE_INTEGER) < 500000000) {
      risks.push('Market cap bajo - alta manipulación posible');
    }
    if (/(incertidumbre|brecha|riesgo soberano|devaluacion)/i.test(signals.macro.context)) {
      risks.push(`Tendencia macro desafiante para ${market}`);
    }
    if (signals.smartMoney.whaleActivity === 'SELLING') {
      risks.push('Movimientos de distribución por manos grandes');
    }
    return risks;
  }

  private getSettled<T>(result: PromiseSettledResult<T>, fallback: T): T {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return fallback;
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, this.round(value)));
  }

  private round(value: number): number {
    return Number(value.toFixed(2));
  }
}
