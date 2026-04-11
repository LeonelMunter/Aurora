import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StrategyService } from '../strategy/strategy.service';
import { RedisPriceService } from '../ingestion/cache/redis-price.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { WealthService } from '../portfolio/wealth/wealth.service';
import { ScoreCalculatorService } from '../sentiment/score-calculator.service';
import { TokenCounterService } from '../ai-router/token-counter.service';
import { AlertEvaluationResult, AlertType } from './alerts.types';
import { Alert } from './entities/alert.entity';

@Injectable()
export class AlertEvaluatorService {
  private readonly logger = new Logger(AlertEvaluatorService.name);

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    private readonly redisPriceService: RedisPriceService,
    private readonly strategyService: StrategyService,
    private readonly scoreCalculatorService: ScoreCalculatorService,
    private readonly wealthService: WealthService,
    private readonly portfolioService: PortfolioService,
    private readonly tokenCounterService: TokenCounterService,
  ) {}

  async evaluateAlert(alert: Alert): Promise<boolean> {
    const result = await this.evaluateAlertState(alert);
    return result.shouldFire;
  }

  async evaluateAlertState(alert: Alert): Promise<AlertEvaluationResult> {
    try {
      const currentValue = await this.resolveCurrentValue(alert);
      return {
        currentValue,
        shouldFire: this.matchesThreshold(alert, currentValue),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`No se pudo evaluar la alerta ${alert.id}: ${message}`);
      throw error;
    }
  }

  shouldTrigger(alert: Alert, currentValue: number): boolean {
    if (!Number.isFinite(currentValue)) {
      return false;
    }

    if (!alert.lastTriggered) {
      return true;
    }

    const elapsedMs = Date.now() - alert.lastTriggered.getTime();
    return elapsedMs >= alert.cooldownMin * 60_000;
  }

  async updateAfterTrigger(alertId: string, currentValue: number): Promise<void> {
    const alert = await this.alertRepository.findOne({ where: { id: alertId } });

    if (!alert) {
      return;
    }

    alert.lastTriggered = new Date();
    alert.currentValue = this.round(currentValue);
    alert.triggerCount += 1;
    await this.alertRepository.save(alert);
  }

  private async resolveCurrentValue(alert: Alert): Promise<number> {
    switch (alert.type) {
      case AlertType.PRICE_ABOVE:
      case AlertType.PRICE_BELOW: {
        if (!alert.symbol || !alert.market) {
          return 0;
        }

        const currentValue = await this.redisPriceService.getPrice(alert.symbol, alert.market);
        return this.round(currentValue ?? 0);
      }
      case AlertType.SCORE_ABOVE: {
        if (!alert.symbol || !alert.market) {
          return 0;
        }

        const recommendation = await this.strategyService.recommendAsset(alert.symbol, alert.market);
        return this.round(recommendation.topStrategy.score);
      }
      case AlertType.SENTIMENT_CHANGE: {
        if (!alert.symbol || !alert.market) {
          return 50;
        }

        const sentiment = await this.scoreCalculatorService.buildSentimentResult(alert.symbol, alert.market);
        return this.round(sentiment.score);
      }
      case AlertType.PORTFOLIO_PNL: {
        const portfolio = await this.portfolioService.getDefaultPortfolio(alert.userId);
        const summary = await this.wealthService.getWealthSummary(alert.userId, portfolio.id);
        return this.round(summary.dayChangePct ?? summary.totalPnlPct ?? 0);
      }
      case AlertType.TOKEN_LIMIT: {
        const stats = await this.tokenCounterService.getTokenStats(alert.userId);
        if (stats.monthlyLimit <= 0) {
          return 0;
        }

        return this.round((stats.costThisMonth / stats.monthlyLimit) * 100);
      }
      case AlertType.MARKET_OPEN:
      case AlertType.CUSTOM:
      default:
        return 0;
    }
  }

  private matchesThreshold(alert: Alert, currentValue: number): boolean {
    switch (alert.type) {
      case AlertType.PRICE_ABOVE:
        return currentValue > alert.threshold;
      case AlertType.PRICE_BELOW:
        return currentValue < alert.threshold;
      case AlertType.SCORE_ABOVE:
        return currentValue > alert.threshold;
      case AlertType.SENTIMENT_CHANGE:
        return Math.abs(currentValue - 50) > alert.threshold;
      case AlertType.PORTFOLIO_PNL:
        return currentValue < -Math.abs(alert.threshold);
      case AlertType.TOKEN_LIMIT:
        return currentValue >= alert.threshold;
      default:
        return false;
    }
  }

  private round(value: number): number {
    return Number(value.toFixed(4));
  }
}
