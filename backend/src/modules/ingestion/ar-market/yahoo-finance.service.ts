import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { AssetMarket } from '../../../shared/enums';
import { SimulatorCandle } from '../../simulator/simulator.types';
import { PriceCandle } from '../entities/price-candle.entity';
import { ALL_AR_STOCK_SYMBOLS, isCedearSymbol } from './ar-market.constants';

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
}

interface HistoricalChanges {
  change30d: number | null;
  change6m: number | null;
  change1y: number | null;
}

@Injectable()
export class YahooFinanceService {
  private readonly logger = new Logger(YahooFinanceService.name);
  private readonly changesCacheTtlMs = 6 * 60 * 60 * 1000;
  private readonly changesCache = new Map<string, { expiresAt: number; data: HistoricalChanges }>();

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(PriceCandle)
    private readonly priceCandleRepository: Repository<PriceCandle>,
  ) {}

  @Cron('0 20 * * 1-5')
  async refreshArUniverseHistory(): Promise<void> {
    await Promise.allSettled(
      ALL_AR_STOCK_SYMBOLS.map((symbol) => this.fetchHistoricalAR(symbol, 365, AssetMarket.STOCK_AR)),
    );
  }

  async fetchHistoricalAR(
    symbol: string,
    days: number,
    market: AssetMarket = AssetMarket.STOCK_AR,
  ): Promise<SimulatorCandle[]> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const yahooSymbol = this.getYahooSymbol(normalizedSymbol, market);
    const range = this.mapDaysToRange(days);

    try {
      const response = await firstValueFrom(
        this.httpService.get<YahooChartResponse>(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`, {
          params: {
            interval: '1d',
            range,
            includePrePost: false,
            events: 'div,splits',
          },
          timeout: 15_000,
        }),
      );

      const candles = this.parseCandles(response.data);
      if (candles.length > 0) {
        await this.persistCandles(normalizedSymbol, market, candles);
      }

      return candles;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`Yahoo Finance no devolvio historial para ${normalizedSymbol}: ${message}`);
      return [];
    }
  }

  async fetchChanges(
    symbol: string,
    market: AssetMarket = AssetMarket.STOCK_AR,
  ): Promise<HistoricalChanges> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const cacheKey = `${market}:${normalizedSymbol}`;
    const cached = this.changesCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    let candles = await this.loadStoredCandles(normalizedSymbol, market, 370);
    if (candles.length < 30) {
      candles = await this.fetchHistoricalAR(normalizedSymbol, 365, market);
    }

    const latest = candles.at(-1) ?? null;
    const data: HistoricalChanges = latest
      ? {
          change30d: this.calculatePctChange(latest.close, this.findReferenceClose(candles, 30)),
          change6m: this.calculatePctChange(latest.close, this.findReferenceClose(candles, 182)),
          change1y: this.calculatePctChange(latest.close, this.findReferenceClose(candles, 365)),
        }
      : {
          change30d: null,
          change6m: null,
          change1y: null,
        };

    this.changesCache.set(cacheKey, {
      expiresAt: Date.now() + this.changesCacheTtlMs,
      data,
    });

    return data;
  }

  private async loadStoredCandles(
    symbol: string,
    market: AssetMarket,
    limit: number,
  ): Promise<SimulatorCandle[]> {
    const rows = await this.priceCandleRepository.find({
      where: {
        symbol,
        market,
        interval: '1d',
      },
      order: { openTime: 'DESC' },
      take: limit,
    });

    return rows
      .sort((left, right) => left.openTime.getTime() - right.openTime.getTime())
      .map((row) => ({
        time: Math.floor(row.openTime.getTime() / 1000),
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      }));
  }

  private async persistCandles(symbol: string, market: AssetMarket, candles: SimulatorCandle[]): Promise<void> {
    const rows = candles.map((candle) => {
      const openTime = new Date(candle.time * 1000);
      const closeTime = new Date(openTime.getTime() + 86_399_000);

      return {
        symbol,
        market,
        interval: '1d',
        openTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        closeTime,
      };
    });

    await this.priceCandleRepository.upsert(rows, ['symbol', 'market', 'interval', 'openTime']);
  }

  private parseCandles(payload: YahooChartResponse): SimulatorCandle[] {
    const result = payload.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const quote = result?.indicators?.quote?.[0];
    const opens = quote?.open ?? [];
    const highs = quote?.high ?? [];
    const lows = quote?.low ?? [];
    const closes = quote?.close ?? [];
    const volumes = quote?.volume ?? [];

    return timestamps
      .map((timestamp, index) => {
        const open = opens[index];
        const high = highs[index];
        const low = lows[index];
        const close = closes[index];
        const volume = volumes[index];

        if (
          typeof timestamp !== 'number' ||
          typeof open !== 'number' ||
          typeof high !== 'number' ||
          typeof low !== 'number' ||
          typeof close !== 'number'
        ) {
          return null;
        }

        return {
          time: timestamp,
          open,
          high,
          low,
          close,
          volume: typeof volume === 'number' ? volume : 0,
        };
      })
      .filter((candle): candle is SimulatorCandle => candle !== null);
  }

  private getYahooSymbol(symbol: string, market: AssetMarket): string {
    if (market === AssetMarket.STOCK_AR && isCedearSymbol(symbol)) {
      return symbol;
    }

    return symbol.endsWith('.BA') ? symbol : `${symbol}.BA`;
  }

  private mapDaysToRange(days: number): string {
    if (days <= 30) return '1mo';
    if (days <= 90) return '3mo';
    if (days <= 180) return '6mo';
    if (days <= 365) return '1y';
    return '2y';
  }

  private findReferenceClose(candles: SimulatorCandle[], daysBack: number): number | null {
    const latest = candles.at(-1);
    if (!latest) {
      return null;
    }

    const target = latest.time - daysBack * 86_400;
    let selected: number | null = null;

    for (const candle of candles) {
      if (candle.time <= target) {
        selected = candle.close;
      } else {
        break;
      }
    }

    return selected;
  }

  private calculatePctChange(current: number, previous: number | null): number | null {
    if (previous === null || previous === 0) {
      return null;
    }

    return Number((((current - previous) / previous) * 100).toFixed(4));
  }
}
