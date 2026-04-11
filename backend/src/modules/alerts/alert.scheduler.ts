import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AssetMarket } from '../../shared/enums';
import { DolarService } from '../ingestion/ar-market/dolar.service';
import { RedisPriceService } from '../ingestion/cache/redis-price.service';
import { StocksArService } from '../ingestion/stocks/stocks-ar.service';
import { AlertTriggerContext, AlertType } from './alerts.types';
import { AlertsService } from './alerts.service';
import { AlertEvaluatorService } from './alert-evaluator.service';
import { Alert } from './entities/alert.entity';
import { NotificationService } from './notification.service';

@Injectable()
export class AlertScheduler {
  private readonly logger = new Logger(AlertScheduler.name);

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    private readonly alertsService: AlertsService,
    private readonly evaluator: AlertEvaluatorService,
    private readonly notificationService: NotificationService,
    private readonly redisPriceService: RedisPriceService,
    private readonly dolarService: DolarService,
    private readonly stocksArService: StocksArService,
  ) {}

  @Cron('*/30 * * * * *')
  async evaluatePriceAlerts(): Promise<void> {
    await this.evaluateByTypes([AlertType.PRICE_ABOVE, AlertType.PRICE_BELOW], 'precio');
  }

  @Cron('0 */5 * * * *')
  async evaluateScoreAlerts(): Promise<void> {
    await this.evaluateByTypes([AlertType.SCORE_ABOVE], 'score');
  }

  @Cron('0 */15 * * * *')
  async evaluateSentimentAlerts(): Promise<void> {
    await this.evaluateByTypes([AlertType.SENTIMENT_CHANGE], 'sentimiento');
  }

  @Cron('0 */30 * * * *')
  async evaluatePortfolioAlerts(): Promise<void> {
    await this.evaluateByTypes([AlertType.PORTFOLIO_PNL], 'portfolio');
  }

  @Cron('0 0 * * * *')
  async evaluateTokenAlerts(): Promise<void> {
    await this.evaluateByTypes([AlertType.TOKEN_LIMIT], 'tokens');
  }

  @Cron('0 0 11 * * 1-5', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  async sendMarketOpenNotification(): Promise<void> {
    const alerts = await this.alertRepository.find({
      where: { type: AlertType.MARKET_OPEN, isActive: true },
    });

    if (alerts.length === 0) {
      return;
    }

    const tracked = await this.stocksArService.fetchAllPrices().catch(() => []);
    const topStock = tracked
      .filter((item) => item.change24h !== null)
      .sort((left, right) => (right.change24h ?? -Infinity) - (left.change24h ?? -Infinity))[0];
    const merval = await this.redisPriceService.getPrice('GGAL', AssetMarket.STOCK_AR).catch(() => null);
    const dolar = await this.dolarService.getDolarData().catch(() => null);
    const topSymbol = topStock?.symbol ?? 'GGAL';
    const topChange = topStock?.change24h ?? null;

    for (const alert of alerts) {
      try {
        const context: AlertTriggerContext = {
          alertId: alert.id,
          userId: alert.userId,
          type: AlertType.MARKET_OPEN,
          threshold: alert.threshold,
          currentValue: topChange ?? 0,
          message:
            `El mercado argentino abrio. ` +
            `Merval: ${merval !== null ? merval.toFixed(2) : 'N/D'}. ` +
            `Dolar MEP: $${dolar?.mep?.toFixed(2) ?? 'N/D'}. ` +
            `Top accion del dia: ${topSymbol} (${topChange !== null ? topChange.toFixed(2) : 'N/D'}%).`,
          metadata: {
            merval,
            dolarMep: dolar?.mep ?? null,
            topSymbol,
            topChange,
          },
        };

        await this.notificationService.send(alert.userId, context, alert.channel);
        await this.evaluator.updateAfterTrigger(alert.id, context.currentValue);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        this.logger.error(`Fallo la notificacion de apertura de mercado para alerta ${alert.id}: ${message}`);
      }
    }
  }

  private async evaluateByTypes(types: AlertType[], label: string): Promise<void> {
    const alerts = await this.alertRepository.find({
      where: types.map((type) => ({ type, isActive: true })),
      order: { createdAt: 'ASC' },
    });

    let evaluated = 0;

    for (const alert of alerts) {
      try {
        const result = await this.evaluator.evaluateAlertState(alert);
        evaluated += 1;

        if (!result.shouldFire || !this.evaluator.shouldTrigger(alert, result.currentValue)) {
          continue;
        }

        const context = this.alertsService.buildTriggerContext(alert, result.currentValue);
        await this.notificationService.send(alert.userId, context, alert.channel);
        await this.evaluator.updateAfterTrigger(alert.id, result.currentValue);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        this.logger.error(`Fallo la evaluacion de la alerta ${alert.id}: ${message}`);
      }
    }

    this.logger.log(`Evaluadas ${evaluated} alertas de ${label}`);
  }
}
