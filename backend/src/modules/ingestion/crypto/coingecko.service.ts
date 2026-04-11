import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { AssetMarket } from '../../../shared/enums';
import { RedisPriceService } from '../cache/redis-price.service';
import { MarketPrice } from '../entities/market-price.entity';
import { PriceCandle } from '../entities/price-candle.entity';

interface CoinGeckoMarketItem {
  id: string;
  symbol: string;
  current_price: number;
  market_cap: number | null;
  total_volume: number | null;
  high_24h: number | null;
  low_24h: number | null;
  price_change_percentage_24h: number | null;
  last_updated: string;
}

type CoinGeckoOhlc = [number, number, number, number, number];

@Injectable()
export class CoinGeckoService implements OnModuleInit {
  private readonly logger = new Logger(CoinGeckoService.name);
  private readonly trackedCoins = new Map<string, string>([
    ['bitcoin', 'BTC'],
    ['ethereum', 'ETH'],
    ['solana', 'SOL'],
    ['binancecoin', 'BNB'],
    ['cardano', 'ADA'],
    ['matic-network', 'MATIC'],
    ['polkadot', 'DOT'],
    ['avalanche-2', 'AVAX'],
    ['chainlink', 'LINK'],
    ['uniswap', 'UNI'],
  ]);

  constructor(
    private readonly httpService: HttpService,
    private readonly redisPriceService: RedisPriceService,
    @InjectRepository(MarketPrice)
    private readonly marketPriceRepository: Repository<MarketPrice>,
    @InjectRepository(PriceCandle)
    private readonly priceCandleRepository: Repository<PriceCandle>,
  ) {}

  onModuleInit(): void {
    void this.fetchTopCryptoPrices();
  }

  @Cron('*/60 * * * * *')
  async fetchTopCryptoPrices(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<CoinGeckoMarketItem[]>('https://api.coingecko.com/api/v3/coins/markets', {
          params: {
            vs_currency: 'usd',
            ids: Array.from(this.trackedCoins.keys()).join(','),
            order: 'market_cap_desc',
            per_page: 10,
            sparkline: false,
          },
        }),
      );

      const redisUpdates = response.data.map((coin) => ({
        symbol: (this.trackedCoins.get(coin.id) ?? coin.symbol).toUpperCase(),
        market: AssetMarket.CRYPTO,
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h,
      }));
      await this.redisPriceService.setMany(redisUpdates);

      await Promise.all(
        response.data.map((coin) =>
          this.marketPriceRepository.upsert(
            {
              symbol: (this.trackedCoins.get(coin.id) ?? coin.symbol).toUpperCase(),
              market: AssetMarket.CRYPTO,
              priceUsd: coin.current_price,
              priceArs: null,
              change24h: coin.price_change_percentage_24h,
              volume24h: coin.total_volume,
              high24h: coin.high_24h,
              low24h: coin.low_24h,
              marketCap: coin.market_cap,
              lastUpdated: new Date(coin.last_updated),
            },
            ['symbol', 'market'],
          ),
        ),
      );
    } catch (error) {
      const status = this.extractStatusCode(error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`CoinGecko fallo al traer precios top: ${message}`);

      if (status === 429) {
        await this.delay(2000);
      }
    }
  }

  async getCandlesFromCoinGecko(coingeckoId: string, days: number): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<CoinGeckoOhlc[]>(`https://api.coingecko.com/api/v3/coins/${coingeckoId}/ohlc`, {
          params: {
            vs_currency: 'usd',
            days,
          },
        }),
      );

      const symbol = this.trackedCoins.get(coingeckoId) ?? coingeckoId.toUpperCase();
      const candles = response.data.map((candle, index, all) => ({
        symbol,
        market: AssetMarket.CRYPTO,
        interval: '1d',
        openTime: new Date(candle[0]),
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: 0,
        closeTime:
          index < all.length - 1 ? new Date(all[index + 1][0] - 1) : new Date(candle[0] + 86_399_999),
      }));

      await this.priceCandleRepository.upsert(candles, ['symbol', 'market', 'interval', 'openTime']);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`CoinGecko fallo al traer velas de ${coingeckoId}: ${message}`);
    }
  }

  private extractStatusCode(error: unknown): number | null {
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const response = error.response as { status?: number };
      return typeof response.status === 'number' ? response.status : null;
    }

    return null;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
