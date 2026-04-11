import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AiRouterModule } from '../ai-router/ai-router.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { NewsItem } from './entities/news-item.entity';
import { SentimentScore } from './entities/sentiment-score.entity';
import { RelevanceFilterService } from './relevance-filter.service';
import { ScoreCalculatorService } from './score-calculator.service';
import { SentimentAnalyzerService } from './sentiment-analyzer.service';
import { SentimentController } from './sentiment.controller';
import { SentimentOrchestrator } from './sentiment.orchestrator';
import { FearGreedSource } from './sources/fear-greed.source';
import { RedditSource } from './sources/reddit.source';
import { RssSource } from './sources/rss.source';

@Module({
  imports: [
    TypeOrmModule.forFeature([NewsItem, SentimentScore]),
    HttpModule,
    IngestionModule,
    AiRouterModule,
    BullModule.registerQueue({ name: 'sentiment' }),
  ],
  providers: [
    JwtAuthGuard,
    RssSource,
    RedditSource,
    FearGreedSource,
    RelevanceFilterService,
    SentimentAnalyzerService,
    ScoreCalculatorService,
    SentimentOrchestrator,
  ],
  controllers: [SentimentController],
  exports: [ScoreCalculatorService, SentimentAnalyzerService],
})
export class SentimentModule {}