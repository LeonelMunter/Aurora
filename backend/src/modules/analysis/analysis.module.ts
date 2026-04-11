import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MarketPrice } from '../ingestion/entities/market-price.entity';
import { PriceCandle } from '../ingestion/entities/price-candle.entity';
import { IngestionModule } from '../ingestion/ingestion.module';
import { StrategyModule } from '../strategy/strategy.module';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([PriceCandle, MarketPrice]),
    IngestionModule,
    forwardRef(() => StrategyModule),
  ],
  providers: [AnalysisService],
  controllers: [AnalysisController],
  exports: [AnalysisService],
})
export class AnalysisModule {}
