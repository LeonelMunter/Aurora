import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { AssetMarket } from '../../../shared/enums';
import { ARStockPrice, DolarData } from '../ar-market/ar-market.types';
import {
  ALL_AR_STOCK_SYMBOLS,
  BYMA_DELAY_NOTE,
  isArMarketOpen,
  isCedearSymbol,
} from '../ar-market/ar-market.constants';
import { DolarService } from '../ar-market/dolar.service';
import { YahooFinanceService } from '../ar-market/yahoo-finance.service';
import { RedisPriceService } from '../cache/redis-price.service';
import { MarketPrice } from '../entities/market-price.entity';

interface QuoteSnapshot {
  symbol: string;
  name: string;
  price: number;
  change24h: number | null;
  volume: number | null;
  lastUpdated: Date;
  source: 'RAVA' | 'AMBITO';
}

@Injectable()
export class StocksArService implements OnModuleInit {
  private readonly logger = new Logger(StocksArService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly redisPriceService: RedisPriceService,
    private readonly dolarService: DolarService,
    private readonly yahooFinanceService: YahooFinanceService,
    @InjectRepository(MarketPrice)
    private readonly marketPriceRepository: Repository<MarketPrice>,
  ) {}

  onModuleInit(): void {
    void this.fetchAllPrices();
  }

  @Cron('*/30 * * * * *')
  async refreshTrackedPrices(): Promise<void> {
    if (!isArMarketOpen()) {
      return;
    }

    await this.fetchAllPrices();
  }

  async fetchAllPrices(): Promise<ARStockPrice[]> {
    const dolarData = await this.dolarService.getDolarData();
    const results = await Promise.allSettled(
      ALL_AR_STOCK_SYMBOLS.map((symbol, index) => this.withDelay(index * 500, () => this.fetchRemotePrice(symbol, dolarData))),
    );

    return results
      .filter((result): result is PromiseFulfilledResult<ARStockPrice | null> => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter((value): value is ARStockPrice => value !== null);
  }

  async fetchPrice(symbol: string): Promise<ARStockPrice | null> {
    const normalized = symbol.trim().toUpperCase();
    const cached = await this.getCachedPrice(normalized);
    if (cached) {
      return cached;
    }

    const dolarData = await this.dolarService.getDolarData();
    return this.fetchRemotePrice(normalized, dolarData);
  }

  isCedearSymbol(symbol: string): boolean {
    return isCedearSymbol(symbol);
  }

  getTrackedSymbols(): string[] {
    return [...ALL_AR_STOCK_SYMBOLS];
  }

  private async fetchRemotePrice(symbol: string, dolarData: DolarData): Promise<ARStockPrice | null> {
    try {
      const quote = (await this.fetchRavaQuote(symbol)) ?? (await this.fetchAmbitoQuote(symbol));
      if (!quote) {
        return this.getCachedPrice(symbol);
      }

      const priceUsd = this.convertArsPriceToUsd(symbol, quote.price, dolarData);
      const variations = await this.yahooFinanceService.fetchChanges(symbol, AssetMarket.STOCK_AR);
      const result: ARStockPrice = {
        symbol,
        name: quote.name,
        priceArs: quote.price,
        priceUsd,
        change24h: quote.change24h,
        change30d: variations.change30d,
        change6m: variations.change6m,
        change1y: variations.change1y,
        volume: quote.volume,
        market: AssetMarket.STOCK_AR,
        source: quote.source,
        currency: 'ARS',
        lastUpdated: quote.lastUpdated,
        note: BYMA_DELAY_NOTE,
      };

      await this.redisPriceService.setPrice(symbol, AssetMarket.STOCK_AR, quote.price, 60, quote.change24h ?? null);
      await this.marketPriceRepository.upsert(
        {
          symbol,
          market: AssetMarket.STOCK_AR,
          priceUsd: result.priceUsd,
          priceArs: result.priceArs,
          currency: 'ARS',
          tcOficial: dolarData.oficial,
          change24h: result.change24h,
          volume24h: result.volume,
          high24h: null,
          low24h: null,
          marketCap: null,
          source: quote.source === 'RAVA' ? 'RAVA' : null,
          exchange: 'BYMA',
          lastUpdated: result.lastUpdated,
        },
        ['symbol', 'market'],
      );

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`No se pudo actualizar accion ${symbol}: ${message}`);
      return this.getCachedPrice(symbol);
    }
  }

  private async fetchRavaQuote(symbol: string): Promise<QuoteSnapshot | null> {
    const response = await firstValueFrom(
      this.httpService.get<unknown>('https://www.rava.com/empresas/cotizacion.php', {
        params: {
          fmt: 'json',
          prod: symbol,
        },
        timeout: 10_000,
      }),
    );

    const quote = this.extractQuote(symbol, response.data);
    return quote ? { ...quote, source: 'RAVA' } : null;
  }

  private async fetchAmbitoQuote(symbol: string): Promise<QuoteSnapshot | null> {
    const response = await firstValueFrom(
      this.httpService.get<unknown>(`https://mercados.ambito.com/acciones/${symbol}/variacion`, {
        timeout: 10_000,
      }),
    );

    const payload = response.data;
    if (!Array.isArray(payload) || payload.length === 0) {
      return null;
    }

    const price = this.toNumber(payload[0]);
    if (price === null) {
      return null;
    }

    return {
      symbol,
      name: symbol,
      price,
      change24h: payload.length > 1 ? this.toNumber(payload[1]) : null,
      volume: null,
      lastUpdated: new Date(),
      source: 'AMBITO',
    };
  }

  private async getCachedPrice(symbol: string): Promise<ARStockPrice | null> {
    const normalized = symbol.trim().toUpperCase();
    const [cached, dbPrice, dolarData, variations] = await Promise.all([
      this.redisPriceService.getPriceEntry(normalized, AssetMarket.STOCK_AR),
      this.marketPriceRepository.findOne({ where: { symbol: normalized, market: AssetMarket.STOCK_AR } }),
      this.dolarService.getDolarData(),
      this.yahooFinanceService.fetchChanges(normalized, AssetMarket.STOCK_AR),
    ]);

    if (!cached && !dbPrice) {
      return null;
    }

    const priceArs = cached?.price ?? dbPrice?.priceArs ?? null;
    if (priceArs === null) {
      return null;
    }

    return {
      symbol: normalized,
      name: normalized,
      priceArs,
      priceUsd: this.convertArsPriceToUsd(normalized, priceArs, dolarData),
      change24h: cached?.change24h ?? dbPrice?.change24h ?? null,
      change30d: variations.change30d,
      change6m: variations.change6m,
      change1y: variations.change1y,
      volume: dbPrice?.volume24h ?? null,
      market: AssetMarket.STOCK_AR,
      source: dbPrice?.source ?? 'RAVA',
      currency: 'ARS',
      lastUpdated: cached ? new Date(cached.timestamp) : dbPrice?.lastUpdated ?? new Date(),
      note: BYMA_DELAY_NOTE,
    };
  }

  private convertArsPriceToUsd(symbol: string, amountArs: number, dolarData: DolarData): number | null {
    const tcMep = dolarData.mep ?? dolarData.oficial ?? null;
    const tcCcl = dolarData.ccl ?? tcMep;
    const rate = isCedearSymbol(symbol) ? tcCcl : tcMep;

    if (rate === null || rate === 0) {
      return null;
    }

    return parseFloat((amountArs / rate).toFixed(4));
  }

  private extractQuote(symbol: string, payload: unknown): Omit<QuoteSnapshot, 'source'> | null {
    const candidate = this.findQuoteCandidate(payload);
    if (!candidate) {
      return null;
    }

    const price = this.toNumber(candidate['ultimo'] ?? candidate['ultimoPrecio'] ?? candidate['precio'] ?? candidate['cierre']);
    if (price === null) {
      return null;
    }

    return {
      symbol,
      name: this.toStringValue(candidate['descripcion'] ?? candidate['nombre'] ?? candidate['especie']) ?? symbol,
      price,
      change24h: this.toNumber(candidate['variacion'] ?? candidate['variacionPorcentual']),
      volume: this.toNumber(candidate['volumen'] ?? candidate['montoOperado']),
      lastUpdated: new Date(),
    };
  }

  private findQuoteCandidate(payload: unknown): Record<string, unknown> | null {
    if (Array.isArray(payload)) {
      for (const item of payload) {
        const found = this.findQuoteCandidate(item);
        if (found) {
          return found;
        }
      }

      return null;
    }

    if (typeof payload !== 'object' || payload === null) {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.some((key) => ['ultimo', 'ultimoPrecio', 'precio', 'cierre'].includes(key))) {
      return record;
    }

    for (const value of Object.values(record)) {
      const found = this.findQuoteCandidate(value);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toStringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private async withDelay<T>(delayMs: number, task: () => Promise<T>): Promise<T> {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return task();
  }
}
