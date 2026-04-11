import { Module, forwardRef } from '@nestjs/common';

import { AnalysisModule } from '../analysis/analysis.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { SentimentModule } from '../sentiment/sentiment.module';
import { StrategyService } from './strategy.service';

@Module({
  imports: [forwardRef(() => AnalysisModule), IngestionModule, SentimentModule],
  providers: [StrategyService],
  exports: [StrategyService],
})
export class StrategyModule {}