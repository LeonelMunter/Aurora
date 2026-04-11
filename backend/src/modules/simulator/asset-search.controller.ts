import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AssetMarket } from '../../shared/enums';
import { MarketPrice } from '../ingestion/entities/market-price.entity';
import { Asset } from '../portfolio/entities/asset.entity';

type SearchMarket = AssetMarket | 'ALL' | 'CEDEARS';

interface AssetSearchResultDto {
  symbol: string;
  name: string;
  market: AssetMarket;
  currentPrice: number | null;
}

@Controller('simulator')
export class AssetSearchController {
  constructor(
    @InjectRepository(MarketPrice)
    private readonly marketPriceRepository: Repository<MarketPrice>,
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
  ) {}

  @Get('search')
  async search(
    @Query('q') q?: string,
    @Query('market') market: SearchMarket = 'ALL',
  ): Promise<AssetSearchResultDto[]> {
    const term = q?.trim() ?? '';
    if (term.length < 1) {
      return [];
    }

    const normalized = term.toUpperCase();
    const [marketPrices, assets] = await Promise.all([
      this.marketPriceRepository.find({
        order: { lastUpdated: 'DESC' },
        take: 50,
      }),
      this.assetRepository.find({
        take: 50,
      }),
    ]);

    const merged = new Map<string, AssetSearchResultDto>();

    for (const row of marketPrices) {
      const key = `${row.market}:${row.symbol}`;
      merged.set(key, {
        symbol: row.symbol,
        name: row.symbol,
        market: row.market,
        currentPrice: row.priceUsd ?? row.priceArs ?? null,
      });
    }

    for (const row of assets) {
      const key = `${row.market}:${row.symbol}`;
      const existing = merged.get(key);
      merged.set(key, {
        symbol: row.symbol,
        name: row.name || existing?.name || row.symbol,
        market: row.market,
        currentPrice: existing?.currentPrice ?? null,
      });
    }

    return [...merged.values()]
      .filter((item) => this.matchesMarketFilter(item, market))
      .filter((item) => {
        const symbol = item.symbol.toUpperCase();
        const name = item.name.toUpperCase();
        return symbol.includes(normalized) || name.includes(normalized);
      })
      .sort((left, right) => this.scoreResult(right, normalized) - this.scoreResult(left, normalized))
      .slice(0, 10);
  }

  private matchesMarketFilter(item: AssetSearchResultDto, market: SearchMarket): boolean {
    if (market === 'ALL') {
      return true;
    }

    if (market === 'CEDEARS') {
      return item.market === AssetMarket.STOCK_AR && ['AAPL', 'GOOGL', 'AMZN', 'MSFT', 'TSLA', 'META', 'NVDA', 'BABA', 'DISN', 'KO'].includes(item.symbol);
    }

    return item.market === market;
  }

  private scoreResult(item: AssetSearchResultDto, term: string): number {
    const symbol = item.symbol.toUpperCase();
    const name = item.name.toUpperCase();

    if (symbol === term) return 300;
    if (name === term) return 260;
    if (symbol.startsWith(term)) return 200;
    if (name.startsWith(term)) return 160;
    if (symbol.includes(term)) return 120;
    if (name.includes(term)) return 80;
    return 0;
  }
}
