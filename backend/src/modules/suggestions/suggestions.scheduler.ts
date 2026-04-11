import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AlertType, NotificationChannel } from '../alerts/alerts.types';
import { Alert } from '../alerts/entities/alert.entity';
import { NotificationService } from '../alerts/notification.service';
import { RedisPriceService } from '../ingestion/cache/redis-price.service';
import { SuggestionsService } from './suggestions.service';

@Injectable()
export class SuggestionsScheduler implements OnModuleInit {
  private readonly logger = new Logger(SuggestionsScheduler.name);

  constructor(
    private readonly suggestionsService: SuggestionsService,
    private readonly redisPriceService: RedisPriceService,
    private readonly notificationService: NotificationService,
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
  ) {}

  async onModuleInit(): Promise<void> {
    const hasSuggestions = await this.suggestionsService.hasAnySuggestions();
    if (!hasSuggestions) {
      this.logger.log('No hay sugerencias persistidas. Se inicia una generacion inicial en background.');
      void this.suggestionsService.refreshSuggestions();
    }
  }

  @Cron('0 */4 * * *')
  async refreshAll(): Promise<void> {
    await this.suggestionsService.refreshSuggestions();
  }

  @Cron('0 8 * * *')
  async morningBrief(): Promise<void> {
    const topSuggestions = await this.suggestionsService.getTopSuggestions(5);
    await this.redisPriceService.setRawValue(
      'suggestions:morning_brief',
      JSON.stringify(topSuggestions),
      24 * 60 * 60,
    );

    const marketOpenAlerts = await this.alertRepository.find({
      where: {
        type: AlertType.MARKET_OPEN,
        isActive: true,
      },
    });

    const top3 = topSuggestions.slice(0, 3).map((item) => `${item.symbol} (${item.convictionScore})`).join(', ');
    await Promise.allSettled(
      marketOpenAlerts.map((alert) =>
        this.notificationService.send(
          alert.userId,
          {
            alertId: alert.id,
            userId: alert.userId,
            type: AlertType.MARKET_OPEN,
            threshold: 0,
            currentValue: 0,
            message: `Top sugerencias del dia: ${top3}`,
            metadata: {
              suggestions: topSuggestions.slice(0, 3).map((item) => ({
                symbol: item.symbol,
                market: item.market,
                score: item.convictionScore,
                category: item.category,
              })),
            },
          },
          alert.channel ?? NotificationChannel.IN_APP,
        ),
      ),
    );

    this.logger.log('Morning brief generado y almacenado');
  }

  @Cron('0 */1 * * *')
  async refreshHighPriority(): Promise<void> {
    await this.suggestionsService.refreshHighPrioritySuggestions();
  }
}
