import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GatewayModule } from '../gateway/gateway.module';
import { BondsService } from './ar-market/bonds.service';
import { DolarService } from './ar-market/dolar.service';
import { YahooFinanceService } from './ar-market/yahoo-finance.service';
import { RedisPriceService } from './cache/redis-price.service';
import { CoinGeckoService } from './crypto/coingecko.service';
import { CryptoIngestionService } from './crypto/crypto-ingestion.service';
import { MarketPrice } from './entities/market-price.entity';
import { PriceCandle } from './entities/price-candle.entity';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { MacroArService } from './macro/macro-ar.service';
import { StocksArService } from './stocks/stocks-ar.service';

@Module({
  imports: [
    GatewayModule,
    HttpModule,
    BullModule.registerQueue({ name: 'ingestion' }),
    TypeOrmModule.forFeature([PriceCandle, MarketPrice]),
  ],
  controllers: [IngestionController],
  providers: [
    IngestionService,
    RedisPriceService,
    CryptoIngestionService,
    CoinGeckoService,
    DolarService,
    StocksArService,
    BondsService,
    MacroArService,
    YahooFinanceService,
  ],
  exports: [
    RedisPriceService,
    CryptoIngestionService,
    CoinGeckoService,
    DolarService,
    StocksArService,
    BondsService,
    MacroArService,
    YahooFinanceService,
  ],
})
export class IngestionModule {}
