import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AnalysisModule } from '../analysis/analysis.module';
import { MarketPrice } from '../ingestion/entities/market-price.entity';
import { PriceCandle } from '../ingestion/entities/price-candle.entity';
import { IngestionModule } from '../ingestion/ingestion.module';
import { Asset } from '../portfolio/entities/asset.entity';
import { AssetSearchController } from './asset-search.controller';
import { BacktestEngineService } from './backtest-engine.service';
import { SimulatorController } from './simulator.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PriceCandle, MarketPrice, Asset]), IngestionModule, AnalysisModule],
  providers: [BacktestEngineService],
  controllers: [SimulatorController, AssetSearchController],
  exports: [BacktestEngineService],
})
export class SimulatorModule {}
