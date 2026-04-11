import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';

import { IngestionModule } from '../ingestion/ingestion.module';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { Asset } from './entities/asset.entity';
import { Import } from './entities/import.entity';
import { Portfolio } from './entities/portfolio.entity';
import { Transaction } from './entities/transaction.entity';
import { WealthSnapshotEntity } from './entities/wealth-snapshot.entity';
import { BinanceParser } from './import/binance.parser';
import { ImportController } from './import/import.controller';
import { ImportService } from './import/import.service';
import { IolParser } from './import/iol.parser';
import { PriceProviderService } from './wealth/price-provider.service';
import { WealthController } from './wealth/wealth.controller';
import { WealthScheduler } from './wealth/wealth.scheduler';
import { WealthService } from './wealth/wealth.service';

@Module({
  imports: [
    HttpModule,
    IngestionModule,
    TypeOrmModule.forFeature([Portfolio, Transaction, Asset, Import, WealthSnapshotEntity]),
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [PortfolioController, ImportController, WealthController],
  providers: [
    PortfolioService,
    ImportService,
    BinanceParser,
    IolParser,
    PriceProviderService,
    WealthService,
    WealthScheduler,
  ],
  exports: [PortfolioService, WealthService],
})
export class PortfolioModule {}
