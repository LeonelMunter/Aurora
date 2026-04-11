import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GatewayService } from '../gateway/gateway.service';
import { AIRequest, AIResponse, TaskType } from './dto/ai-router.types';
import { AiModel } from './entities/ai-model.entity';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { TokenCounterService } from './token-counter.service';

interface RouteCandidate {
  provider: 'GOOGLE' | 'ANTHROPIC' | 'OPENAI';
  modelString: string;
}

@Injectable()
export class AiRouterService {
  private readonly logger = new Logger(AiRouterService.name);
  private readonly routingTable: Record<TaskType, string> = {
    FILTER_RELEVANCE: 'gemini-2.5-flash-lite',
    SENTIMENT_NEWS: 'gemini-2.5-flash',
    SUMMARIZE: 'gemini-2.5-flash',
    RECOMMENDATION: 'gemini-2.5-pro',
    FULL_ANALYSIS: 'gemini-2.5-pro',
    CHAT: 'gemini-2.5-flash',
    WEB_SEARCH: 'gemini-2.5-flash',
  };

  constructor(
    @InjectRepository(AiModel)
    private readonly aiModelRepository: Repository<AiModel>,
    private readonly geminiProvider: GeminiProvider,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly openAIProvider: OpenAIProvider,
    private readonly tokenCounter: TokenCounterService,
    private readonly gatewayService: GatewayService,
  ) {}

  async route(request: AIRequest): Promise<AIResponse> {
    if (request.userId) {
      const canContinue = await this.tokenCounter.checkLimits(request.userId);
      if (!canContinue) {
        throw new ForbiddenException('Límite mensual de IA alcanzado');
      }
    }

    const candidates = this.buildCandidates(request.taskType);
    const errors: string[] = [];

    for (const candidate of candidates) {
      const model = await this.aiModelRepository.findOne({
        where: { modelString: candidate.modelString, isActive: true },
      });

      if (!model) {
        continue;
      }

      if (model.freeTierLimit !== null) {
        const requestsToday = await this.tokenCounter.getRequestsToday(model.modelString);
        if (requestsToday >= model.freeTierLimit) {
          errors.push(`Free tier agotado para ${model.modelString}`);
          continue;
        }
      }

      try {
        const response = await this.callProvider(candidate, request);
        await this.tokenCounter.logUsage({
          userId: request.userId ?? null,
          modelId: model.id,
          taskType: request.taskType,
          tokensInput: response.tokensInput,
          tokensOutput: response.tokensOutput,
          costUsd: response.costUsd,
          sessionId: request.sessionId ?? null,
          durationMs: response.durationMs,
          isFreeTier: response.isFreeTier,
        });

        if (request.userId) {
          const tokenStats = await this.tokenCounter.getTokenStats(request.userId, request.sessionId);
          this.gatewayService.emitToUser(request.userId, 'token.update', tokenStats);
        }

        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        errors.push(`${candidate.modelString}: ${message}`);
        if (!(error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS)) {
          this.logger.warn(`Fallback AI Router por error en ${candidate.modelString}: ${message}`);
        }
      }
    }

    throw new ServiceUnavailableException(
      'Todos los modelos de IA no están disponibles. Verificá tu configuración en /configuracion.',
    );
  }

  async chat(prompt: string, userId?: string, sessionId?: string): Promise<AIResponse> {
    return this.route({
      taskType: 'CHAT',
      prompt,
      userId,
      sessionId,
    });
  }

  async analyze(content: string, taskType: Exclude<TaskType, 'CHAT'>, userId?: string): Promise<AIResponse> {
    return this.route({
      taskType,
      prompt: content,
      userId,
    });
  }

  private buildCandidates(taskType: TaskType): RouteCandidate[] {
    const primary = this.routingTable[taskType];
    const geminiOrder = primary === 'gemini-2.5-flash-lite'
      ? ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro']
      : primary === 'gemini-2.5-flash'
        ? ['gemini-2.5-flash', 'gemini-2.5-pro']
        : ['gemini-2.5-pro', 'gemini-2.5-flash'];

    return [
      ...geminiOrder.map((modelString) => ({ provider: 'GOOGLE' as const, modelString })),
      { provider: 'ANTHROPIC' as const, modelString: 'claude-haiku-4-5' },
      { provider: 'OPENAI' as const, modelString: 'gpt-5-mini' },
    ];
  }

  private async callProvider(candidate: RouteCandidate, request: AIRequest): Promise<AIResponse> {
    switch (candidate.provider) {
      case 'GOOGLE':
        return this.geminiProvider.call(request, candidate.modelString);
      case 'ANTHROPIC':
        return this.anthropicProvider.call(request, candidate.modelString);
      case 'OPENAI':
        return this.openAIProvider.call(request, candidate.modelString);
      default:
        throw new ServiceUnavailableException('Proveedor de IA no soportado.');
    }
  }
}
