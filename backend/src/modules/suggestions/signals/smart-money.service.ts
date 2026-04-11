import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { AssetMarket } from '../../../shared/enums';
import { MarketPrice } from '../../ingestion/entities/market-price.entity';
import { PriceCandle } from '../../ingestion/entities/price-candle.entity';
import { SmartMoneySignal } from '../suggestions.types';

interface WhaleAlertResponse {
  transactions?: Array<{
    to?: { owner_type?: string };
    from?: { owner_type?: string };
  }>;
}

@Injectable()
export class SmartMoneyService {
  private readonly logger = new Logger(SmartMoneyService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(MarketPrice)
    private readonly marketPriceRepository: Repository<MarketPrice>,
    @InjectRepository(PriceCandle)
    private readonly priceCandleRepository: Repository<PriceCandle>,
  ) {}

  async getScore(symbol: string, market: AssetMarket): Promise<SmartMoneySignal> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const unusualVolume = await this.detectUnusualVolume(normalizedSymbol, market);

    let score = 50;
    let whaleActivity: SmartMoneySignal['whaleActivity'] = 'UNAVAILABLE';

    if (market === AssetMarket.CRYPTO) {
      whaleActivity = await this.detectWhaleActivity(normalizedSymbol);
      if (whaleActivity === 'BUYING') {
        score += 25;
      }
      if (whaleActivity === 'SELLING') {
        score -= 20;
      }
    } else {
      whaleActivity = 'NEUTRAL';
    }

    if (unusualVolume) {
      score += 15;
    }

    return {
      score: this.clamp(score),
      whaleActivity,
      unusualVolume,
      sourceDetails: { market },
    };
  }

  private async detectWhaleActivity(
    symbol: string,
  ): Promise<'BUYING' | 'SELLING' | 'NEUTRAL' | 'UNAVAILABLE'> {
    const apiKey = process.env.WHALE_ALERT_API_KEY?.trim();
    if (!apiKey) {
      return 'UNAVAILABLE';
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<WhaleAlertResponse>('https://api.whale-alert.io/v1/transactions', {
          params: {
            api_key: apiKey,
            min_value: 1000000,
            currency: symbol.toLowerCase(),
            limit: 10,
          },
        }),
      );

      const transactions = response.data.transactions ?? [];
      let buying = 0;
      let selling = 0;
      for (const tx of transactions) {
        const toType = tx.to?.owner_type?.toLowerCase() ?? '';
        const fromType = tx.from?.owner_type?.toLowerCase() ?? '';
        if (toType.includes('exchange')) {
          selling += 1;
        } else if (fromType.includes('exchange')) {
          buying += 1;
        }
      }

      if (buying > selling) {
        return 'BUYING';
      }
      if (selling > buying) {
        return 'SELLING';
      }
      return 'NEUTRAL';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`Whale Alert no disponible para ${symbol}: ${message}`);
      return 'UNAVAILABLE';
    }
  }

  private async detectUnusualVolume(symbol: string, market: AssetMarket): Promise<boolean> {
    const marketPrice = await this.marketPriceRepository.findOne({ where: { symbol, market } });
    const currentVolume = marketPrice?.volume24h ?? null;

    const candles = await this.priceCandleRepository.find({
      where: { symbol, market, interval: '1d' },
      order: { openTime: 'DESC' },
      take: 21,
    });

    if (candles.length < 5 && currentVolume === null) {
      return false;
    }

    const threshold = market === AssetMarket.CRYPTO ? 2 : 1.5;
    if (currentVolume !== null && candles.length > 0) {
      const average = candles.reduce((sum, candle) => sum + candle.volume, 0) / candles.length;
      return average > 0 ? currentVolume > average * threshold : false;
    }

    const [latest, ...history] = candles;
    const average = history.reduce((sum, candle) => sum + candle.volume, 0) / history.length;
    return average > 0 ? latest.volume > average * threshold : false;
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, Number(value.toFixed(2))));
  }
}
