import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import Parser from 'rss-parser';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { AssetMarket } from '../../shared/enums';
import { CRYPTO_UNIVERSE } from './asset-universe';
import { EmergingAsset } from './entities/emerging-asset.entity';

interface CoinGeckoMarketResponseItem {
  id: string;
  symbol: string;
  name: string;
  market_cap: number | null;
}

interface CoinGeckoTrendingResponse {
  coins?: Array<{
    item?: {
      id?: string;
      symbol?: string;
      name?: string;
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
export class EmergingDetectorService {
  private readonly logger = new Logger(EmergingDetectorService.name);
  private readonly rssParser = new Parser();

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(EmergingAsset)
    private readonly emergingAssetRepository: Repository<EmergingAsset>,
  ) {}

  @Cron('0 */6 * * *')
  async detectNewAssets(): Promise<void> {
    const [known, marketItems, binanceItems, trending] = await Promise.all([
      this.emergingAssetRepository.find(),
      this.fetchCoinGeckoMarkets(),
      this.fetchBinanceListings(),
      this.fetchTrendingCoins(),
    ]);

    const knownSymbols = new Set(known.map((asset) => asset.symbol.toUpperCase()));
    const discoveries: EmergingAsset[] = [];

    for (const item of marketItems) {
      const symbol = item.symbol.toUpperCase();
      if (knownSymbols.has(symbol) || (item.market_cap ?? 0) <= 10000000) {
        continue;
      }

      discoveries.push(this.emergingAssetRepository.create({
        symbol,
        name: item.name,
        market: AssetMarket.CRYPTO,
        coingeckoId: item.id,
        discoveredAt: new Date(),
        listingDate: null,
        listingExchange: 'OTHER',
        marketCap: item.market_cap,
        isActive: true,
        source: 'COINGECKO_NEW',
      }));
      knownSymbols.add(symbol);
    }

    for (const item of binanceItems) {
      if (knownSymbols.has(item.symbol)) {
        continue;
      }

      discoveries.push(this.emergingAssetRepository.create({
        symbol: item.symbol,
        name: item.name,
        market: AssetMarket.CRYPTO,
        coingeckoId: null,
        discoveredAt: new Date(),
        listingDate: item.listingDate,
        listingExchange: 'BINANCE',
        marketCap: null,
        isActive: true,
        source: 'BINANCE_LISTING',
      }));
      knownSymbols.add(item.symbol);
    }

    for (const item of trending) {
      if (knownSymbols.has(item.symbol) || CRYPTO_UNIVERSE.includes(item.symbol)) {
        continue;
      }

      discoveries.push(this.emergingAssetRepository.create({
        symbol: item.symbol,
        name: item.name,
        market: AssetMarket.CRYPTO,
        coingeckoId: item.id,
        discoveredAt: new Date(),
        listingDate: null,
        listingExchange: 'OTHER',
        marketCap: null,
        isActive: true,
        source: 'COINGECKO_NEW',
      }));
      knownSymbols.add(item.symbol);
    }

    if (discoveries.length > 0) {
      await this.emergingAssetRepository.save(discoveries);
      this.logger.log(`${discoveries.length} activos emergentes nuevos detectados`);
    }
  }

  async getEmergingAssets(): Promise<EmergingAsset[]> {
    const since = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    return this.emergingAssetRepository.find({
      where: {
        isActive: true,
        discoveredAt: MoreThanOrEqual(since),
      },
      order: { discoveredAt: 'DESC' },
    });
  }

  private async fetchCoinGeckoMarkets(): Promise<CoinGeckoMarketResponseItem[]> {
    try {
      const apiUrl = process.env.COINGECKO_API_URL ?? 'https://api.coingecko.com/api/v3';
      const response = await firstValueFrom(
        this.httpService.get<CoinGeckoMarketResponseItem[]>(`${apiUrl}/coins/markets`, {
          params: {
            vs_currency: 'usd',
            order: 'id_asc',
            per_page: 250,
            page: 1,
            sparkline: false,
          },
        }),
      );
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`CoinGecko markets no disponible: ${message}`);
      return [];
    }
  }

  private async fetchTrendingCoins(): Promise<Array<{ id: string | null; symbol: string; name: string }>> {
    try {
      const apiUrl = process.env.COINGECKO_API_URL ?? 'https://api.coingecko.com/api/v3';
      const response = await firstValueFrom(
        this.httpService.get<CoinGeckoTrendingResponse>(`${apiUrl}/search/trending`),
      );
      return (response.data.coins ?? [])
        .map((coin) => ({
          id: coin.item?.id ?? null,
          symbol: coin.item?.symbol?.toUpperCase() ?? '',
          name: coin.item?.name ?? coin.item?.symbol?.toUpperCase() ?? '',
        }))
        .filter((coin) => coin.symbol.length > 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`CoinGecko trending no disponible: ${message}`);
      return [];
    }
  }

  private async fetchBinanceListings(): Promise<Array<{ symbol: string; name: string; listingDate: Date }>> {
    try {
      const feed = await this.rssParser.parseURL(
        'https://www.binance.com/en/support/announcement/rss/new-cryptocurrency-listing',
      ) as BinanceFeed;

      return (feed.items ?? [])
        .map((item) => {
          const text = `${item.title ?? ''} ${item.contentSnippet ?? ''}`.toUpperCase();
          const match = text.match(/\(([A-Z0-9]{2,10})\)/) ?? text.match(/\b([A-Z0-9]{2,10})\b/);
          const symbol = match?.[1] ?? '';
          return {
            symbol,
            name: item.title ?? symbol,
            listingDate: item.pubDate ? new Date(item.pubDate) : new Date(),
          };
        })
        .filter((item) => item.symbol.length > 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`RSS Binance no disponible: ${message}`);
      return [];
    }
  }
}
