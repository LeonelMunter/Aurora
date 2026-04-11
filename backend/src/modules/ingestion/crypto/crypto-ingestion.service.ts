import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import WebSocket from 'ws';

import { AssetMarket } from '../../../shared/enums';
import { GatewayService } from '../../gateway/gateway.service';
import { RedisPriceService } from '../cache/redis-price.service';
import { MarketPrice } from '../entities/market-price.entity';
import { PriceCandle } from '../entities/price-candle.entity';

interface BinanceTickerData {
  s: string;
  c: string;
  P: string;
  v: string;
  h: string;
  l: string;
}

interface BinanceTickerMessage {
  stream: string;
  data: BinanceTickerData;
}

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

@Injectable()
export class CryptoIngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CryptoIngestionService.name);
  private readonly monitoredSymbols = new Set<string>([
    'BTC',
    'ETH',
    'SOL',
    'BNB',
    'ADA',
    'MATIC',
    'DOT',
    'AVAX',
    'LINK',
    'UNI',
  ]);
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private webSocket: WebSocket | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly redisPriceService: RedisPriceService,
    private readonly gatewayService: GatewayService,
    @InjectRepository(PriceCandle)
    private readonly priceCandleRepository: Repository<PriceCandle>,
    @InjectRepository(MarketPrice)
    private readonly marketPriceRepository: Repository<MarketPrice>,
  ) {}

  onModuleInit(): void {
    this.connectBinanceWebSocket();
  }

  onModuleDestroy(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.webSocket?.close();
  }

  connectBinanceWebSocket(): void {
    const symbols = this.getMonitoredSymbols();
    const streams = symbols.map((symbol) => `${symbol.toLowerCase()}usdt@ticker`).join('/');
    const wsBaseUrl = process.env.BINANCE_WS_URL ?? 'wss://stream.binance.com:9443';
    const wsUrl = `${wsBaseUrl}/stream?streams=${streams}`;

    this.webSocket?.close();
    this.logger.log(`Conectando Binance WebSocket: ${wsUrl}`);
    this.webSocket = new WebSocket(wsUrl);

    this.webSocket.on('message', (rawData: WebSocket.RawData) => {
      void this.handleTickerMessage(rawData);
    });

    this.webSocket.on('close', () => {
      this.logger.warn('Binance WebSocket desconectado. Reintentando en 5 segundos.');
      this.scheduleReconnect();
    });

    this.webSocket.on('error', (error: Error) => {
      this.logger.error(`Error en Binance WebSocket: ${error.message}`);
    });
  }

  async fetchHistoricalCandles(symbol: string, interval: string, limit: number): Promise<void> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    try {
      const response = await firstValueFrom(
        this.httpService.get<BinanceKline[]>('https://api.binance.com/api/v3/klines', {
          params: {
            symbol: `${normalizedSymbol}USDT`,
            interval,
            limit,
          },
        }),
      );

      const candles = response.data.map((candle) => ({
        symbol: normalizedSymbol,
        market: AssetMarket.CRYPTO,
        interval,
        openTime: new Date(candle[0]),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: new Date(candle[6]),
      }));

      await this.priceCandleRepository.upsert(candles, ['symbol', 'market', 'interval', 'openTime']);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`No se pudieron obtener velas historicas de ${normalizedSymbol}: ${message}`);
    }
  }

  getMonitoredSymbols(): string[] {
    return Array.from(this.monitoredSymbols.values());
  }

  addSymbol(symbol: string): void {
    const normalizedSymbol = symbol.trim().toUpperCase();

    if (this.monitoredSymbols.has(normalizedSymbol)) {
      return;
    }

    this.monitoredSymbols.add(normalizedSymbol);
    this.logger.log(`Agregado simbolo ${normalizedSymbol} al monitoreo cripto.`);
    this.connectBinanceWebSocket();
  }

  private async handleTickerMessage(rawData: WebSocket.RawData): Promise<void> {
    try {
      const message = JSON.parse(rawData.toString()) as BinanceTickerMessage;
      const symbol = message.data.s.replace(/USDT$/i, '').toUpperCase();
      const price = parseFloat(message.data.c);
      const change24h = parseFloat(message.data.P);
      const volume24h = parseFloat(message.data.v);
      const high24h = parseFloat(message.data.h);
      const low24h = parseFloat(message.data.l);

      await this.redisPriceService.setPrice(symbol, AssetMarket.CRYPTO, price, 30, change24h);
      await this.marketPriceRepository.upsert(
        {
          symbol,
          market: AssetMarket.CRYPTO,
          priceUsd: price,
          priceArs: null,
          change24h,
          volume24h,
          high24h,
          low24h,
          marketCap: null,
          lastUpdated: new Date(),
        },
        ['symbol', 'market'],
      );

      this.gatewayService.emitPriceUpdated({
        symbol,
        market: AssetMarket.CRYPTO,
        price,
        change24h,
        volume24h,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`No se pudo procesar mensaje de Binance WS: ${message}`);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.connectBinanceWebSocket();
    }, 5000);
  }
}
