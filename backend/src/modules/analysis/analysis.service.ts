import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { ATR, BollingerBands, MACD, RSI, SMA } from 'technicalindicators';
import { Repository } from 'typeorm';

import { AssetMarket } from '../../shared/enums';
import { YahooFinanceService } from '../ingestion/ar-market/yahoo-finance.service';
import { RedisPriceService } from '../ingestion/cache/redis-price.service';
import { CryptoIngestionService } from '../ingestion/crypto/crypto-ingestion.service';
import { MarketPrice } from '../ingestion/entities/market-price.entity';
import { PriceCandle } from '../ingestion/entities/price-candle.entity';
import {
  ATRResult,
  BollingerResult,
  HistoricalPerformance,
  MACDResult,
  OHLCV,
  RSIResult,
  TechnicalAnalysis,
  TrendResult,
} from './analysis.types';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly historicalChangeCacheTtlSeconds = 6 * 60 * 60;
  private readonly symbolToCoinGeckoId = new Map<string, string>([
    ['BTC', 'bitcoin'],
    ['ETH', 'ethereum'],
    ['SOL', 'solana'],
    ['ADA', 'cardano'],
    ['BNB', 'binancecoin'],
    ['XRP', 'ripple'],
    ['MATIC', 'matic-network'],
    ['DOT', 'polkadot'],
    ['AVAX', 'avalanche-2'],
    ['LINK', 'chainlink'],
    ['UNI', 'uniswap'],
    ['ATOM', 'cosmos'],
    ['LTC', 'litecoin'],
    ['NEAR', 'near'],
    ['ARB', 'arbitrum'],
    ['OP', 'optimism'],
  ]);

  constructor(
    @InjectRepository(PriceCandle)
    private readonly priceCandleRepository: Repository<PriceCandle>,
    @InjectRepository(MarketPrice)
    private readonly marketPriceRepository: Repository<MarketPrice>,
    private readonly cryptoIngestionService: CryptoIngestionService,
    private readonly redisPriceService: RedisPriceService,
    private readonly httpService: HttpService,
    private readonly yahooFinanceService: YahooFinanceService,
  ) {}

  async getCoverageReport(symbols: string[], market: AssetMarket): Promise<Array<{
    symbol: string;
    market: AssetMarket;
    priceAvailable: boolean;
    candlesBefore: number;
    candlesAfter: number;
    historicalLoadAttempted: boolean;
    analysisReady: boolean;
    notes: string[];
  }>> {
    const uniqueSymbols = Array.from(new Set(symbols.map((symbol) => this.normalizeSymbol(symbol))));

    return Promise.all(uniqueSymbols.map((symbol) => this.auditSingleSymbol(symbol, market)));
  }

  async getCandles(symbol: string, market: AssetMarket, interval: string, limit: number): Promise<OHLCV[]> {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    let candles = await this.loadCandles(normalizedSymbol, market, interval, limit);

    if (market === AssetMarket.CRYPTO && candles.length < 50) {
      await this.cryptoIngestionService.fetchHistoricalCandles(normalizedSymbol, interval, Math.max(limit, 120));
      candles = await this.loadCandles(normalizedSymbol, market, interval, limit);
    }

    if ((market === AssetMarket.STOCK_AR || market === AssetMarket.BOND) && interval === '1d' && candles.length < 30) {
      await this.yahooFinanceService.fetchHistoricalAR(normalizedSymbol, Math.max(limit, 365), market);
      candles = await this.loadCandles(normalizedSymbol, market, interval, limit);
    }

    return candles;
  }

  async getCandlesForChart(symbol: string, market: AssetMarket, days = 365, interval = '1d'): Promise<OHLCV[]> {
    const lookback = Math.max(30, Math.min(days + 10, 800));
    const candles = await this.getCandles(symbol, market, interval, lookback);
    const latest = candles.at(-1);

    if (!latest) {
      return [];
    }

    const targetTime = latest.time - days * 86_400_000;
    return candles.filter((candle) => candle.time >= targetTime);
  }

  calculateRSI(closes: number[]): RSIResult {
    if (closes.length < 14) {
      return {
        value: null,
        signal: 'NEUTRAL',
        message: 'Sin datos suficientes. Se necesitan al menos 14 velas.',
      };
    }

    const values = RSI.calculate({ period: 14, values: closes });
    const lastValue = values.at(-1) ?? null;

    if (lastValue === null) {
      return {
        value: null,
        signal: 'NEUTRAL',
        message: 'No se pudo calcular RSI con las velas disponibles.',
      };
    }

    return {
      value: this.round(lastValue),
      signal: lastValue < 30 ? 'OVERSOLD' : lastValue > 70 ? 'OVERBOUGHT' : 'NEUTRAL',
      message: null,
    };
  }

  calculateMACD(closes: number[]): MACDResult {
    if (closes.length < 26) {
      return {
        macd: null,
        signal: null,
        histogram: null,
        trend: 'NEUTRAL',
        message: 'Sin datos suficientes. Se necesitan al menos 26 velas.',
      };
    }

    const values = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const last = values.at(-1);
    const prev = values.at(-2);

    if (!last) {
      return {
        macd: null,
        signal: null,
        histogram: null,
        trend: 'NEUTRAL',
        message: 'No se pudo calcular MACD con las velas disponibles.',
      };
    }

    const histogram = last.histogram ?? 0;
    const previousHistogram = prev?.histogram ?? histogram;
    const trend = histogram > 0 && histogram > previousHistogram
      ? 'BULLISH'
      : histogram < 0 && histogram < previousHistogram
        ? 'BEARISH'
        : 'NEUTRAL';

    return {
      macd: this.round(last.MACD ?? 0),
      signal: this.round(last.signal ?? 0),
      histogram: this.round(histogram),
      trend,
      message: null,
    };
  }

  calculateBollinger(closes: number[]): BollingerResult {
    if (closes.length < 20) {
      return {
        upper: null,
        middle: null,
        lower: null,
        width: null,
        position: 'INSIDE',
        message: 'Sin datos suficientes. Se necesitan al menos 20 velas.',
      };
    }

    const values = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
    const last = values.at(-1);
    const lastClose = closes.at(-1) ?? null;

    if (!last || lastClose === null) {
      return {
        upper: null,
        middle: null,
        lower: null,
        width: null,
        position: 'INSIDE',
        message: 'No se pudo calcular Bollinger Bands con las velas disponibles.',
      };
    }

    const width = last.middle !== 0 ? ((last.upper - last.lower) / last.middle) * 100 : 0;
    const position = lastClose > last.upper ? 'ABOVE' : lastClose < last.lower ? 'BELOW' : 'INSIDE';

    return {
      upper: this.round(last.upper),
      middle: this.round(last.middle),
      lower: this.round(last.lower),
      width: this.round(width),
      position,
      message: null,
    };
  }

  calculateATR(candles: OHLCV[]): ATRResult {
    if (candles.length < 14) {
      return {
        value: null,
        volatility: 'LOW',
        message: 'Sin datos suficientes. Se necesitan al menos 14 velas.',
      };
    }

    const values = ATR.calculate({
      period: 14,
      high: candles.map((candle) => candle.high),
      low: candles.map((candle) => candle.low),
      close: candles.map((candle) => candle.close),
    });
    const lastValue = values.at(-1) ?? null;
    const lastClose = candles.at(-1)?.close ?? null;

    if (lastValue === null || lastClose === null || lastClose === 0) {
      return {
        value: null,
        volatility: 'LOW',
        message: 'No se pudo calcular ATR con las velas disponibles.',
      };
    }

    const atrPct = (lastValue / lastClose) * 100;

    return {
      value: this.round(lastValue),
      volatility: atrPct < 2 ? 'LOW' : atrPct < 5 ? 'MEDIUM' : 'HIGH',
      message: null,
    };
  }

  calculateTrend(closes: number[]): TrendResult {
    const currentClose = closes.at(-1) ?? null;

    if (currentClose === null || closes.length < 7) {
      return {
        direction: 'LATERAL',
        strength: 'WEAK',
        days7: null,
        days30: null,
        days90: null,
        message: 'Sin datos suficientes. Se necesitan al menos 7 velas para estimar tendencia.',
      };
    }

    const day7Close = closes.length > 7 ? closes[closes.length - 8] : null;
    const day30Close = closes.length > 30 ? closes[closes.length - 31] : null;
    const day90Close = closes.length > 90 ? closes[closes.length - 91] : null;

    const days7 = this.calculatePctChange(currentClose, day7Close);
    const days30 = this.calculatePctChange(currentClose, day30Close);
    const days90 = this.calculatePctChange(currentClose, day90Close);
    const reference = days30 ?? days7 ?? 0;

    const direction = reference > 3 ? 'UP' : reference < -3 ? 'DOWN' : 'LATERAL';
    const absReference = Math.abs(reference);
    const strength = absReference < 5 ? 'WEAK' : absReference < 15 ? 'MODERATE' : 'STRONG';

    void SMA.calculate({ period: Math.min(7, closes.length), values: closes });
    if (closes.length >= 30) {
      void SMA.calculate({ period: 30, values: closes });
    }
    if (closes.length >= 90) {
      void SMA.calculate({ period: 90, values: closes });
    }

    return {
      direction,
      strength,
      days7: days7 !== null ? this.round(days7) : null,
      days30: days30 !== null ? this.round(days30) : null,
      days90: days90 !== null ? this.round(days90) : null,
      message: closes.length < 30 ? 'La lectura mejora a medida que se acumulan mas velas historicas.' : null,
    };
  }

  async analyzeAsset(symbol: string, market: AssetMarket, interval = '1d'): Promise<TechnicalAnalysis> {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const candles = await this.getCandles(normalizedSymbol, market, interval, 120);

    if (candles.length === 0) {
      throw new NotFoundException(`No hay datos para ${normalizedSymbol}`);
    }

    const closes = candles.map((candle) => candle.close);
    const volumes = candles.map((candle) => candle.volume);
    const lastPrice = closes.at(-1);

    if (lastPrice === undefined) {
      throw new NotFoundException(`No hay datos para ${normalizedSymbol}`);
    }

    const rsi = this.calculateRSI(closes);
    const macd = this.calculateMACD(closes);
    const bollinger = this.calculateBollinger(closes);
    const atr = this.calculateATR(candles);
    const trend = this.calculateTrend(closes);

    const lastVolume = volumes.at(-1) ?? 0;
    const last20Volumes = volumes.slice(-20);
    const avg20 = last20Volumes.length > 0
      ? last20Volumes.reduce((sum, volume) => sum + volume, 0) / last20Volumes.length
      : null;
    const relativeVolume = avg20 && avg20 > 0 ? this.round(lastVolume / avg20) : null;

    return {
      symbol: normalizedSymbol,
      market,
      interval,
      rsi,
      macd,
      bollinger,
      atr,
      trend,
      volume: {
        current: this.round(lastVolume),
        avg20: avg20 !== null ? this.round(avg20) : null,
        relativeVolume,
      },
      lastPrice: this.round(lastPrice),
      analyzedAt: new Date(),
    };
  }

  async analyzeMultiple(symbols: string[], market: AssetMarket): Promise<TechnicalAnalysis[]> {
    const results = await Promise.allSettled(symbols.map((symbol) => this.analyzeAsset(symbol, market)));

    return results
      .filter((result): result is PromiseFulfilledResult<TechnicalAnalysis> => result.status === 'fulfilled')
      .map((result) => result.value);
  }

  async getHistoricalPerformance(symbol: string, market: AssetMarket): Promise<HistoricalPerformance> {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const candles = await this.getCandles(normalizedSymbol, market, '1d', 370);
    const latest = candles.at(-1);

    if (!latest) {
      return {
        change7d: null,
        change30d: null,
        change6m: null,
        change1y: null,
      };
    }

    const localChange7d = this.calculatePctChange(latest.close, this.findClosestCandle(candles, 7)?.close ?? null);
    const localChange30d = this.calculatePctChange(latest.close, this.findClosestCandle(candles, 30)?.close ?? null);
    const localChange6m = this.calculatePctChange(latest.close, this.findClosestCandle(candles, 182)?.close ?? null);
    const localChange1y = this.calculatePctChange(latest.close, this.findClosestCandle(candles, 365)?.close ?? null);

    if (market === AssetMarket.CRYPTO) {
      const [change6m, change1y] = await Promise.all([
        localChange6m ?? this.getHistoricalChange(normalizedSymbol, 180),
        localChange1y ?? this.getHistoricalChange(normalizedSymbol, 365),
      ]);

      return {
        change7d: localChange7d !== null ? this.round(localChange7d) : null,
        change30d: localChange30d !== null ? this.round(localChange30d) : null,
        change6m: change6m !== null ? this.round(change6m) : null,
        change1y: change1y !== null ? this.round(change1y) : null,
      };
    }

    if (market === AssetMarket.STOCK_AR || market === AssetMarket.BOND) {
      const yahooChanges = await this.yahooFinanceService.fetchChanges(normalizedSymbol, market);
      return {
        change7d: localChange7d !== null ? this.round(localChange7d) : null,
        change30d: localChange30d !== null ? this.round(localChange30d) : yahooChanges.change30d,
        change6m: localChange6m !== null ? this.round(localChange6m) : yahooChanges.change6m,
        change1y: localChange1y !== null ? this.round(localChange1y) : yahooChanges.change1y,
      };
    }

    return {
      change7d: localChange7d !== null ? this.round(localChange7d) : null,
      change30d: localChange30d !== null ? this.round(localChange30d) : null,
      change6m: localChange6m !== null ? this.round(localChange6m) : null,
      change1y: localChange1y !== null ? this.round(localChange1y) : null,
    };
  }

  async getHistoricalChange(symbol: string, days: number): Promise<number | null> {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const coinGeckoId = this.symbolToCoinGeckoId.get(normalizedSymbol);

    if (!coinGeckoId) {
      return null;
    }

    const cacheKey = `price_change:${normalizedSymbol}:${days}`;
    const cachedValue = await this.redisPriceService.getRawValue(cacheKey);
    if (cachedValue !== null) {
      if (cachedValue === 'null') {
        return null;
      }

      const parsed = Number(cachedValue);
      return Number.isFinite(parsed) ? parsed : null;
    }

    try {
      const apiUrl = process.env.COINGECKO_API_URL ?? 'https://api.coingecko.com/api/v3';
      const response = await firstValueFrom(
        this.httpService.get<{ prices?: Array<[number, number]> }>(`${apiUrl}/coins/${coinGeckoId}/market_chart`, {
          params: {
            vs_currency: 'usd',
            days,
          },
          timeout: 15_000,
        }),
      );

      const prices = response.data.prices ?? [];
      const firstPrice = prices[0]?.[1] ?? null;
      const currentPrice = prices.at(-1)?.[1] ?? null;
      const change = currentPrice !== null && firstPrice !== null ? this.calculatePctChange(currentPrice, firstPrice) : null;

      await this.redisPriceService.setRawValue(cacheKey, change === null ? 'null' : change.toString(), this.historicalChangeCacheTtlSeconds);
      return change !== null ? this.round(change) : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`CoinGecko no devolvio cambio historico para ${normalizedSymbol} ${days}d: ${message}`);
      await this.redisPriceService.setRawValue(cacheKey, 'null', this.historicalChangeCacheTtlSeconds);
      return null;
    }
  }

  private async auditSingleSymbol(symbol: string, market: AssetMarket): Promise<{
    symbol: string;
    market: AssetMarket;
    priceAvailable: boolean;
    candlesBefore: number;
    candlesAfter: number;
    historicalLoadAttempted: boolean;
    analysisReady: boolean;
    notes: string[];
  }> {
    const notes: string[] = [];
    const cachedPrice = await this.redisPriceService.getPriceEntry(symbol, market);
    const dbPrice = await this.marketPriceRepository.findOne({
      where: { symbol, market },
    });
    const priceAvailable = Boolean(cachedPrice || dbPrice);
    const candlesBefore = await this.priceCandleRepository.count({
      where: { symbol, market, interval: '1d' },
    });
    let candlesAfter = candlesBefore;
    let historicalLoadAttempted = false;

    if (market === AssetMarket.CRYPTO && candlesBefore < 50) {
      historicalLoadAttempted = true;
      await this.cryptoIngestionService.fetchHistoricalCandles(symbol, '1d', 120);
      candlesAfter = await this.priceCandleRepository.count({
        where: { symbol, market, interval: '1d' },
      });
    }

    if ((market === AssetMarket.STOCK_AR || market === AssetMarket.BOND) && candlesBefore < 30) {
      historicalLoadAttempted = true;
      await this.yahooFinanceService.fetchHistoricalAR(symbol, 365, market);
      candlesAfter = await this.priceCandleRepository.count({
        where: { symbol, market, interval: '1d' },
      });
    }

    if (!priceAvailable) {
      notes.push('Sin precio en cache ni en base.');
    }
    if (candlesAfter === 0) {
      notes.push('Sin velas historicas para detalle.');
    } else if (candlesAfter < 14) {
      notes.push('Hay historial minimo, pero no alcanza para todos los indicadores.');
    }
    if (historicalLoadAttempted && candlesAfter === candlesBefore) {
      notes.push('Se intento cargar historial y no se sumaron velas nuevas.');
    }

    return {
      symbol,
      market,
      priceAvailable,
      candlesBefore,
      candlesAfter,
      historicalLoadAttempted,
      analysisReady: candlesAfter > 0,
      notes,
    };
  }

  private async loadCandles(symbol: string, market: AssetMarket, interval: string, limit: number): Promise<OHLCV[]> {
    const rows = await this.priceCandleRepository.find({
      where: {
        symbol,
        market,
        interval,
      },
      order: { openTime: 'DESC' },
      take: limit,
    });

    return rows
      .sort((left, right) => left.openTime.getTime() - right.openTime.getTime())
      .map((candle) => ({
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        time: candle.openTime.getTime(),
      }));
  }

  private findClosestCandle(candles: OHLCV[], daysBack: number): OHLCV | null {
    const latest = candles.at(-1);
    if (!latest) {
      return null;
    }

    const targetTime = latest.time - daysBack * 86_400_000;
    let selected: OHLCV | null = null;

    for (const candle of candles) {
      if (candle.time <= targetTime) {
        selected = candle;
      } else {
        break;
      }
    }

    return selected;
  }

  private normalizeSymbol(symbol: string): string {
    const normalizedSymbol = symbol.trim().toUpperCase();

    if (normalizedSymbol.length < 2) {
      throw new BadRequestException('Símbolo inválido');
    }

    return normalizedSymbol;
  }

  private calculatePctChange(current: number, previous: number | null): number | null {
    if (previous === null || previous === 0) {
      return null;
    }

    return ((current - previous) / previous) * 100;
  }

  private round(value: number): number {
    return Number(value.toFixed(4));
  }
}
