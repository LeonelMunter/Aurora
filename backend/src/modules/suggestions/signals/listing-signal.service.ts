import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import Parser from 'rss-parser';
import { Repository } from 'typeorm';

import { AssetMarket } from '../../../shared/enums';
import { ASSET_NAMES } from '../asset-universe';
import { EmergingAsset } from '../entities/emerging-asset.entity';
import { ListingSignal } from '../suggestions.types';

interface CoinGeckoCoinItem {
  id: string;
  symbol: string;
  name: string;
}

interface CoinGeckoTrendingResponse {
  coins?: Array<{
    item?: {
      symbol?: string;
    };
  }>;
}

type BinanceFeed = {
  items?: Array<{
    title?: string;
    contentSnippet?: string;
    pubDate?: string;
  }>;
};

@Injectable()
export class ListingSignalService {
  private readonly logger = new Logger(ListingSignalService.name);
  private readonly rssParser = new Parser();

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(EmergingAsset)
    private readonly emergingAssetRepository: Repository<EmergingAsset>,
  ) {}

  async getScore(symbol: string, market: AssetMarket): Promise<ListingSignal> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    let score = 50;
    let isNew = false;
    let listingDate: string | null = null;
    let trendingBonus = false;

    if (market === AssetMarket.CRYPTO) {
      const [binanceMatch, trending, knownEmerging] = await Promise.all([
        this.findBinanceListing(normalizedSymbol),
        this.isCoinGeckoTrending(normalizedSymbol),
        this.emergingAssetRepository.findOne({ where: { symbol: normalizedSymbol, isActive: true } }),
      ]);

      if (binanceMatch) {
        score = 95;
        isNew = true;
        listingDate = binanceMatch.toISOString();
      } else if (knownEmerging?.listingDate && this.daysSince(knownEmerging.listingDate) <= 30) {
        score = 75;
        isNew = true;
        listingDate = knownEmerging.listingDate.toISOString();
      } else if (await this.isRecentlyDiscoveredCoin(normalizedSymbol)) {
        score = 75;
        isNew = true;
      }

      if (trending) {
        score += 20;
        trendingBonus = true;
      }
    } else if (market === AssetMarket.STOCK_AR) {
      const bymaListing = await this.findBymaListing(normalizedSymbol);
      if (bymaListing) {
        score = 75;
        isNew = true;
        listingDate = bymaListing.toISOString();
      }
    }

    return {
      score: this.clamp(score),
      isNew,
      listingDate,
      sourceDetails: { trendingBonus },
    };
  }

  private async findBinanceListing(symbol: string): Promise<Date | null> {
    try {
      const feed = await this.rssParser.parseURL(
        'https://www.binance.com/en/support/announcement/rss/new-cryptocurrency-listing',
      ) as BinanceFeed;

      const match = (feed.items ?? []).find((item) => {
        const haystack = `${item.title ?? ''} ${item.contentSnippet ?? ''}`.toUpperCase();
        const assetName = (ASSET_NAMES[symbol] ?? symbol).toUpperCase();
        return haystack.includes(symbol) || haystack.includes(assetName);
      });

      return match?.pubDate ? new Date(match.pubDate) : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`No se pudo leer RSS de Binance: ${message}`);
      return null;
    }
  }

  private async isRecentlyDiscoveredCoin(symbol: string): Promise<boolean> {
    try {
      const apiUrl = process.env.COINGECKO_API_URL ?? 'https://api.coingecko.com/api/v3';
      const response = await firstValueFrom(
        this.httpService.get<CoinGeckoCoinItem[]>(`${apiUrl}/coins/list`, {
          params: { include_platform: false },
        }),
      );

      return response.data.some((coin) => coin.symbol.toUpperCase() === symbol);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`CoinGecko list no disponible para ${symbol}: ${message}`);
      return false;
    }
  }

  private async isCoinGeckoTrending(symbol: string): Promise<boolean> {
    try {
      const apiUrl = process.env.COINGECKO_API_URL ?? 'https://api.coingecko.com/api/v3';
      const response = await firstValueFrom(
        this.httpService.get<CoinGeckoTrendingResponse>(`${apiUrl}/search/trending`),
      );
      return (response.data.coins ?? []).some((coin) => coin.item?.symbol?.toUpperCase() === symbol);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`CoinGecko trending no disponible para ${symbol}: ${message}`);
      return false;
    }
  }

  private async findBymaListing(symbol: string): Promise<Date | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<string>('https://www.byma.com.ar/', {
          responseType: 'text',
        }),
      );
      const body = typeof response.data === 'string' ? response.data.toUpperCase() : '';
      const assetName = (ASSET_NAMES[symbol] ?? symbol).toUpperCase();
      const mentionsAsset = body.includes(symbol) || body.includes(assetName);
      const mentionsListing = /(NUEVAS EMISIONES|NUEVO LISTADO|NUEVA EMISION|LISTADO)/.test(body);
      return mentionsAsset && mentionsListing ? new Date() : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`No se pudo revisar BYMA para ${symbol}: ${message}`);
      return null;
    }
  }

  private daysSince(date: Date): number {
    return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, Number(value.toFixed(2))));
  }
}
