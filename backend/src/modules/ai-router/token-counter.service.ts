import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { AiLimit } from './entities/ai-limit.entity';
import { AiModel } from './entities/ai-model.entity';
import { AiUsageLog } from './entities/ai-usage-log.entity';
import { AIProvider, TokenStats } from './dto/ai-router.types';

@Injectable()
export class TokenCounterService {
  constructor(
    @InjectRepository(AiModel)
    private readonly aiModelRepository: Repository<AiModel>,
    @InjectRepository(AiUsageLog)
    private readonly aiUsageLogRepository: Repository<AiUsageLog>,
    @InjectRepository(AiLimit)
    private readonly aiLimitRepository: Repository<AiLimit>,
  ) {}

  async getRequestsToday(modelString: string): Promise<number> {
    const model = await this.aiModelRepository.findOne({ where: { modelString } });

    if (!model) {
      return 0;
    }

    return this.aiUsageLogRepository.count({
      where: {
        modelId: model.id,
        createdAt: MoreThanOrEqual(this.getUtcDayStart()),
      },
    });
  }

  async getMonthCost(userId: string): Promise<number> {
    const logs = await this.aiUsageLogRepository.find({
      where: {
        userId,
        createdAt: MoreThanOrEqual(this.getUtcMonthStart()),
      },
    });

    return Number(logs.reduce((sum, log) => sum + log.costUsd, 0).toFixed(6));
  }

  async getSessionTokens(sessionId: string): Promise<number> {
    const logs = await this.aiUsageLogRepository.find({ where: { sessionId } });
    return logs.reduce((sum, log) => sum + log.tokensInput + log.tokensOutput, 0);
  }

  async logUsage(data: Partial<AiUsageLog>): Promise<AiUsageLog> {
    const usage = this.aiUsageLogRepository.create({
      userId: data.userId ?? null,
      modelId: data.modelId ?? '',
      taskType: data.taskType ?? 'CHAT',
      tokensInput: data.tokensInput ?? 0,
      tokensOutput: data.tokensOutput ?? 0,
      costUsd: data.costUsd ?? 0,
      sessionId: data.sessionId ?? null,
      durationMs: data.durationMs ?? 0,
      isFreeTier: data.isFreeTier ?? false,
    });

    return this.aiUsageLogRepository.save(usage);
  }

  async getTokenStats(userId?: string, sessionId?: string): Promise<TokenStats> {
    const primaryModel = await this.aiModelRepository.findOne({
      where: { isPrimary: true, isActive: true },
    });

    if (!primaryModel) {
      return {
        provider: 'GOOGLE',
        modelString: 'gemini-2.5-flash-lite',
        versionLabel: 'Gemini 2.5 Flash-Lite',
        mode: 'FREE_TIER',
        requestsToday: 0,
        requestsLimit: 0,
        tokensSession: 0,
        tokensInputTotal: 0,
        tokensOutputTotal: 0,
        costUsd: 0,
        costThisMonth: 0,
        monthlyLimit: 50,
        alertAtPct: 80,
        limitReached: false,
      };
    }

    const requestsToday = await this.getRequestsToday(primaryModel.modelString);
    const tokensSession = sessionId ? await this.getSessionTokens(sessionId) : 0;
    const costThisMonth = userId ? await this.getMonthCost(userId) : 0;
    const userLimit = userId ? await this.aiLimitRepository.findOne({ where: { userId } }) : null;
    const userLogs = userId ? await this.aiUsageLogRepository.find({ where: { userId } }) : [];

    return {
      provider: primaryModel.provider as AIProvider,
      modelString: primaryModel.modelString,
      versionLabel: primaryModel.versionLabel,
      mode: primaryModel.freeTierLimit !== null ? 'FREE_TIER' : 'PAID',
      requestsToday,
      requestsLimit: primaryModel.freeTierLimit,
      tokensSession,
      tokensInputTotal: userLogs.reduce((sum, log) => sum + log.tokensInput, 0),
      tokensOutputTotal: userLogs.reduce((sum, log) => sum + log.tokensOutput, 0),
      costUsd: Number(userLogs.reduce((sum, log) => sum + log.costUsd, 0).toFixed(6)),
      costThisMonth,
      monthlyLimit: userLimit?.monthlyLimitUsd ?? 50,
      alertAtPct: userLimit?.alertAtPct ?? 80,
      limitReached: costThisMonth >= (userLimit?.monthlyLimitUsd ?? 50),
    };
  }

  async checkLimits(userId: string): Promise<boolean> {
    const limit = await this.aiLimitRepository.findOne({ where: { userId } });

    if (!limit) {
      return true;
    }

    const monthCost = await this.getMonthCost(userId);
    return !(limit.blockOnLimit && monthCost >= limit.monthlyLimitUsd);
  }

  private getUtcDayStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private getUtcMonthStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
}
