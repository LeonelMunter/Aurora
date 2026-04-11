import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AlertsModule } from '../alerts/alerts.module';
import { Alert } from '../alerts/entities/alert.entity';
import { AnalysisModule } from '../analysis/analysis.module';
import { AiRouterModule } from '../ai-router/ai-router.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { MarketPrice } from '../ingestion/entities/market-price.entity';
import { PriceCandle } from '../ingestion/entities/price-candle.entity';
import { NewsItem } from '../sentiment/entities/news-item.entity';
import { SentimentScore } from '../sentiment/entities/sentiment-score.entity';
import { SentimentModule } from '../sentiment/sentiment.module';
import { StrategyModule } from '../strategy/strategy.module';
import { ConvictionEngineService } from './conviction-engine.service';
import { EmergingDetectorService } from './emerging-detector.service';
import { EmergingAsset } from './entities/emerging-asset.entity';
import { SuggestionChat } from './entities/suggestion-chat.entity';
import { Suggestion } from './entities/suggestion.entity';
import { SuggestionBotService } from './suggestion-bot.service';
import { FundamentalSignalService } from './signals/fundamental-signal.service';
import { ListingSignalService } from './signals/listing-signal.service';
import { SmartMoneyService } from './signals/smart-money.service';
import { SocialSignalService } from './signals/social-signal.service';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsScheduler } from './suggestions.scheduler';
import { SuggestionsService } from './suggestions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Suggestion,
      EmergingAsset,
      SuggestionChat,
      MarketPrice,
      PriceCandle,
      SentimentScore,
      NewsItem,
      Alert,
    ]),
    HttpModule,
    IngestionModule,
    AnalysisModule,
    SentimentModule,
    AiRouterModule,
    StrategyModule,
    AlertsModule,
  ],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    SuggestionsService,
    ConvictionEngineService,
    EmergingDetectorService,
    SuggestionsScheduler,
    SuggestionBotService,
    SocialSignalService,
    SmartMoneyService,
    ListingSignalService,
    FundamentalSignalService,
  ],
  controllers: [SuggestionsController],
  exports: [SuggestionsService, SuggestionBotService],
})
export class SuggestionsModule {}
