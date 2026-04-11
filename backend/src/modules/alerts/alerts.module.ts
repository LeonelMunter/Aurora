import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiRouterModule } from '../ai-router/ai-router.module';
import { GatewayModule } from '../gateway/gateway.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { SentimentModule } from '../sentiment/sentiment.module';
import { StrategyModule } from '../strategy/strategy.module';
import { AlertEvaluatorService } from './alert-evaluator.service';
import { AlertsController } from './alerts.controller';
import { AlertScheduler } from './alert.scheduler';
import { AlertsService } from './alerts.service';
import { Alert } from './entities/alert.entity';
import { Notification } from './entities/notification.entity';
import { NotificationService } from './notification.service';
import { EmailService } from './notifications/email.service';
import { TelegramService } from './notifications/telegram.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert, Notification]),
    IngestionModule,
    StrategyModule,
    PortfolioModule,
    AiRouterModule,
    SentimentModule,
    GatewayModule,
  ],
  providers: [
    AlertsService,
    AlertEvaluatorService,
    AlertScheduler,
    NotificationService,
    TelegramService,
    EmailService,
  ],
  controllers: [AlertsController],
  exports: [AlertsService, NotificationService],
})
export class AlertsModule {}
