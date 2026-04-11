import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { AssetMarket } from '../../../shared/enums';

interface PriceCacheEntry {
  price: number;
  timestamp: string;
  change24h: number | null;
}

interface BulkPriceEntry {
  symbol: string;
  market: AssetMarket;
  price: number;
  change24h?: number | null;
}

@Injectable()
export class RedisPriceService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisPriceService.name);
  private readonly redis: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, { lazyConnect: false });
    this.redis.on('error', (error: Error) => {
      this.logger.error(`Error de Redis en cache de precios: ${error.message}`);
    });
  }

  async setPrice(
    symbol: string,
    market: AssetMarket,
    price: number,
    ttlSeconds = 30,
    change24h: number | null = null,
  ): Promise<void> {
    const key = this.buildKey(symbol, market);
    const payload: PriceCacheEntry = {
      price,
      timestamp: new Date().toISOString(),
      change24h,
    };

    await this.redis.set(key, JSON.stringify(payload), 'EX', ttlSeconds);
  }

  async getPrice(symbol: string, market: AssetMarket): Promise<number | null> {
    const entry = await this.getPriceEntry(symbol, market);
    return entry?.price ?? null;
  }

  async setMany(prices: BulkPriceEntry[]): Promise<void> {
    if (prices.length === 0) {
      return;
    }

    const pipeline = this.redis.pipeline();

    for (const price of prices) {
      const key = this.buildKey(price.symbol, price.market);
      const payload: PriceCacheEntry = {
        price: price.price,
        timestamp: new Date().toISOString(),
        change24h: price.change24h ?? null,
      };
      pipeline.set(key, JSON.stringify(payload), 'EX', 30);
    }

    await pipeline.exec();
  }

  async getPriceMap(symbols: string[], market: AssetMarket): Promise<Map<string, number>> {
    if (symbols.length === 0) {
      return new Map<string, number>();
    }

    const keys = symbols.map((symbol) => this.buildKey(symbol, market));
    const values = await this.redis.mget(...keys);
    const priceMap = new Map<string, number>();

    values.forEach((value, index) => {
      if (!value) {
        return;
      }

      try {
        const parsed = JSON.parse(value) as PriceCacheEntry;
        priceMap.set(symbols[index], parsed.price);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        this.logger.warn(`No se pudo parsear cache de precio para ${symbols[index]}: ${message}`);
      }
    });

    return priceMap;
  }

  async getPriceEntry(symbol: string, market: AssetMarket): Promise<PriceCacheEntry | null> {
    const key = this.buildKey(symbol, market);
    const value = await this.redis.get(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as PriceCacheEntry;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`No se pudo parsear el precio cacheado de ${symbol}: ${message}`);
      return null;
    }
  }

  async getRawValue(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async setRawValue(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(key, value, 'EX', ttlSeconds);
      return;
    }

    await this.redis.set(key, value);
  }

  async ping(): Promise<'PONG'> {
    const response = await this.redis.ping();
    return response as 'PONG';
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private buildKey(symbol: string, market: AssetMarket): string {
    return `price:${market}:${symbol.trim().toUpperCase()}`;
  }
}
