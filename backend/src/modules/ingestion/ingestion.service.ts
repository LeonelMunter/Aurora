import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { DataSource, Repository } from 'typeorm';

import { AssetMarket } from '../../shared/enums';
import { YahooFinanceService } from './ar-market/yahoo-finance.service';
import { RedisPriceService } from './cache/redis-price.service';
import { CryptoIngestionService } from './crypto/crypto-ingestion.service';
import { MarketPrice } from './entities/market-price.entity';
import { PriceCandle } from './entities/price-candle.entity';
import { MacroArService } from './macro/macro-ar.service';
import { StocksArService } from './stocks/stocks-ar.service';

@Injectable()
export class IngestionService {
  constructor(
    private readonly redisPriceService: RedisPriceService,
    private readonly macroArService: MacroArService,
    private readonly cryptoIngestionService: CryptoIngestionService,
    private readonly stocksArService: StocksArService,
    private readonly yahooFinanceService: YahooFinanceService,
    private readonly httpService: HttpService,
    private readonly dataSource: DataSource,
    @InjectRepository(MarketPrice)
    private readonly marketPriceRepository: Repository<MarketPrice>,
    @InjectRepository(PriceCandle)
    private readonly priceCandleRepository: Repository<PriceCandle>,
  ) {}

  async getPrices(
    symbols: string[],
    market: AssetMarket,
  ): Promise<Array<{ symbol: string; market: AssetMarket; priceUsd: number | null; change24h: number | null; volume24h: number | null; lastUpdated: Date | null }>> {
    const results = await Promise.all(symbols.map((symbol) => this.getPriceBySymbol(symbol, market)));
    return results.map((result) => ({
      symbol: result.symbol,
      market: result.market,
      priceUsd: result.priceUsd,
      change24h: result.change24h,
      volume24h: result.volume24h,
      lastUpdated: result.lastUpdated,
    }));
  }

  async getPriceBySymbol(
    symbol: string,
    market: AssetMarket,
  ): Promise<{ symbol: string; market: AssetMarket; priceUsd: number | null; priceArs: number | null; change24h: number | null; volume24h: number | null; high24h: number | null; low24h: number | null; marketCap: number | null; lastUpdated: Date | null }> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const cached = await this.redisPriceService.getPriceEntry(normalizedSymbol, market);

    if (cached) {
      const dbFallback = await this.marketPriceRepository.findOne({
        where: { symbol: normalizedSymbol, market },
      });

      const isArMarket = market === AssetMarket.STOCK_AR || market === AssetMarket.BOND;

      return {
        symbol: normalizedSymbol,
        market,
        priceUsd: isArMarket ? dbFallback?.priceUsd ?? null : cached.price,
        priceArs: isArMarket ? cached.price : dbFallback?.priceArs ?? null,
        change24h: cached.change24h,
        volume24h: dbFallback?.volume24h ?? null,
        high24h: dbFallback?.high24h ?? null,
        low24h: dbFallback?.low24h ?? null,
        marketCap: dbFallback?.marketCap ?? null,
        lastUpdated: new Date(cached.timestamp),
      };
    }

    const dbPrice = await this.marketPriceRepository.findOne({
      where: { symbol: normalizedSymbol, market },
    });

    if (!dbPrice) {
      throw new NotFoundException('No se encontro precio para el activo solicitado.');
    }

    return {
      symbol: dbPrice.symbol,
      market: dbPrice.market,
      priceUsd: dbPrice.priceUsd,
      priceArs: dbPrice.priceArs,
      change24h: dbPrice.change24h,
      volume24h: dbPrice.volume24h,
      high24h: dbPrice.high24h,
      low24h: dbPrice.low24h,
      marketCap: dbPrice.marketCap,
      lastUpdated: dbPrice.lastUpdated,
    };
  }

  async getMacroAr() {
    return this.macroArService.getMacroData();
  }

  async getDiagnostic() {
    const timestamp = new Date().toISOString();

    const [coingecko, binanceWs, rava, bcra, redis, database] = await Promise.all([
      this.measureLatency(async () => {
        const apiUrl = process.env.COINGECKO_API_URL ?? 'https://api.coingecko.com/api/v3';
        await firstValueFrom(this.httpService.get(`${apiUrl}/ping`, { timeout: 10_000 }));
      }),
      this.checkBinanceWs(),
      this.measureLatency(async () => {
        const price = await this.stocksArService.fetchPrice('GGAL');
        if (!price) {
          throw new Error('GGAL sin precio');
        }
      }),
      this.measureLatency(async () => {
        const today = new Date().toISOString().slice(0, 10);
        const response = await firstValueFrom(
          this.httpService.get<{ results?: Array<{ valor?: number }> }>(
            `https://api.bcra.gob.ar/estadisticas/v2.0/datosvariable/4/${today}/${today}`,
            { timeout: 10_000 },
          ),
        );
        const officialRate = response.data.results?.at(-1)?.valor ?? null;
        if (officialRate === null) {
          throw new Error('TC oficial BCRA no disponible');
        }
      }),
      this.checkRedis(),
      this.checkDatabase(),
    ]);

    return {
      coingecko,
      binanceWs,
      rava,
      bcra,
      redis,
      database,
      timestamp,
    };
  }

  async loadHistory(symbol: string, market: AssetMarket, days: number): Promise<{ candles: number; symbol: string; days: number }> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    if (market === AssetMarket.CRYPTO) {
      await this.cryptoIngestionService.fetchHistoricalCandles(normalizedSymbol, '1d', days);
    } else if (market === AssetMarket.STOCK_AR || market === AssetMarket.BOND) {
      await this.yahooFinanceService.fetchHistoricalAR(normalizedSymbol, days, market);
    } else {
      throw new NotFoundException('La carga historica manual no esta disponible para este mercado.');
    }

    const candles = await this.priceCandleRepository.count({
      where: {
        symbol: normalizedSymbol,
        market,
        interval: '1d',
      },
    });

    return {
      candles,
      symbol: normalizedSymbol,
      days,
    };
  }

  private async checkBinanceWs(): Promise<{ status: 'ok' | 'error'; pricesInCache: number }> {
    const entries = await Promise.all(
      ['BTC', 'ETH', 'SOL'].map((symbol) => this.redisPriceService.getPriceEntry(symbol, AssetMarket.CRYPTO)),
    );

    const pricesInCache = entries.filter((entry) => entry?.price !== null && entry?.price !== undefined).length;

    return {
      status: pricesInCache > 0 ? 'ok' : 'error',
      pricesInCache,
    };
  }

  private async checkRedis(): Promise<{ status: 'ok' | 'error' }> {
    try {
      const response = await this.redisPriceService.ping();
      return { status: response === 'PONG' ? 'ok' : 'error' };
    } catch {
      return { status: 'error' };
    }
  }

  private async checkDatabase(): Promise<{ status: 'ok' | 'error' }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok' };
    } catch {
      return { status: 'error' };
    }
  }

  private async measureLatency(task: () => Promise<void>): Promise<{ status: 'ok' | 'error'; latencyMs: number }> {
    const startedAt = Date.now();

    try {
      await task();
      return {
        status: 'ok',
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      return {
        status: 'error',
        latencyMs: Date.now() - startedAt,
      };
    }
  }
}



