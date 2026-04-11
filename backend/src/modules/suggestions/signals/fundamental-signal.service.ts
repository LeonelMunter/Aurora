import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { AssetMarket } from '../../../shared/enums';
import { MarketPrice } from '../../ingestion/entities/market-price.entity';
import { MacroArService } from '../../ingestion/macro/macro-ar.service';
import { NewsItem, NewsSource } from '../../sentiment/entities/news-item.entity';
import { FundamentalSignal } from '../suggestions.types';

interface GitHubRepoSearchResponse {
  items?: Array<{
    stargazers_count?: number;
    pushed_at?: string;
  }>;
}

interface CoinGeckoSupplyResponse {
  market_data?: {
    circulating_supply?: number | null;
    total_supply?: number | null;
  };
}

@Injectable()
export class FundamentalSignalService {
  private readonly logger = new Logger(FundamentalSignalService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly macroArService: MacroArService,
    @InjectRepository(MarketPrice)
    private readonly marketPriceRepository: Repository<MarketPrice>,
    @InjectRepository(NewsItem)
    private readonly newsItemRepository: Repository<NewsItem>,
  ) {}

  async getScore(symbol: string, market: AssetMarket): Promise<FundamentalSignal> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    if (market === AssetMarket.CRYPTO) {
      return this.buildCryptoFundamentals(normalizedSymbol);
    }
    if (market === AssetMarket.BOND) {
      return this.buildBondFundamentals(normalizedSymbol);
    }
    return this.buildStockFundamentals(normalizedSymbol, market);
  }

  private async buildCryptoFundamentals(symbol: string): Promise<FundamentalSignal> {
    const marketPrice = await this.marketPriceRepository.findOne({
      where: { symbol, market: AssetMarket.CRYPTO },
    });
    const marketCap = marketPrice?.marketCap ?? null;

    let score = 35;
    if (marketCap !== null && marketCap > 10000000000) {
      score = 80;
    } else if (marketCap !== null && marketCap >= 1000000000) {
      score = 65;
    } else if (marketCap !== null && marketCap >= 100000000) {
      score = 50;
    }

    const [githubMetrics, supplyBonus] = await Promise.all([
      this.fetchGithubMetrics(symbol),
      this.fetchSupplyBonus(symbol),
    ]);

    score += githubMetrics.scoreBonus + supplyBonus;

    return {
      score: this.clamp(score),
      marketCap,
      githubActivity: githubMetrics.activity,
      sourceDetails: {
        stars: githubMetrics.stars,
        supplyBonus,
      },
    };
  }

  private async buildStockFundamentals(symbol: string, market: AssetMarket): Promise<FundamentalSignal> {
    const marketPrice = await this.marketPriceRepository.findOne({ where: { symbol, market } });
    let score = 55;
    if ((marketPrice?.change24h ?? 0) > 3) {
      score = 70;
    }

    const sectorBoost = await this.detectSectorBoost(symbol);
    score += sectorBoost;

    return {
      score: this.clamp(score),
      marketCap: marketPrice?.marketCap ?? null,
      githubActivity: null,
      sourceDetails: { sectorBoost },
    };
  }

  private async buildBondFundamentals(symbol: string): Promise<FundamentalSignal> {
    const marketPrice = await this.marketPriceRepository.findOne({
      where: { symbol, market: AssetMarket.BOND },
    });

    const parity = marketPrice?.priceUsd ?? marketPrice?.priceArs ?? null;
    let score = 55;
    if (parity !== null && parity < 50) {
      score = 40;
    } else if (parity !== null && parity > 70) {
      score = 70;
    }

    const [macro, mep] = await Promise.all([
      this.macroArService.getMacroData(),
      this.macroArService.getDolarMep(),
    ]);

    if (
      macro.tcOficial !== null &&
      mep !== null &&
      macro.tcOficial > 0 &&
      mep > macro.tcOficial * 1.1
    ) {
      score -= 10;
    }

    return {
      score: this.clamp(score),
      marketCap: null,
      githubActivity: null,
      sourceDetails: { parity },
    };
  }

  private async fetchGithubMetrics(
    symbol: string,
  ): Promise<{ activity: number | null; stars: number | null; scoreBonus: number }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<GitHubRepoSearchResponse>('https://api.github.com/search/repositories', {
          params: {
            q: `${symbol} crypto`,
            sort: 'stars',
          },
          headers: {
            'User-Agent': 'Aurora-Suggestions',
          },
        }),
      );

      const repo = response.data.items?.[0];
      if (!repo) {
        return { activity: null, stars: null, scoreBonus: 0 };
      }

      let bonus = 0;
      const pushedAt = repo.pushed_at ? new Date(repo.pushed_at) : null;
      const daysSincePush = pushedAt
        ? (Date.now() - pushedAt.getTime()) / (24 * 60 * 60 * 1000)
        : null;
      if (daysSincePush !== null && daysSincePush <= 30) {
        bonus += 15;
      }
      if ((repo.stargazers_count ?? 0) > 1000) {
        bonus += 10;
      }

      return {
        activity: daysSincePush === null ? null : Math.max(0, 30 - Math.floor(daysSincePush)),
        stars: repo.stargazers_count ?? null,
        scoreBonus: bonus,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`GitHub search no disponible para ${symbol}: ${message}`);
      return { activity: null, stars: null, scoreBonus: 0 };
    }
  }

  private async fetchSupplyBonus(symbol: string): Promise<number> {
    try {
      const apiUrl = process.env.COINGECKO_API_URL ?? 'https://api.coingecko.com/api/v3';
      const response = await firstValueFrom(
        this.httpService.get<CoinGeckoSupplyResponse>(`${apiUrl}/coins/${symbol.toLowerCase()}`),
      );
      const circulating = response.data.market_data?.circulating_supply ?? null;
      const total = response.data.market_data?.total_supply ?? null;
      if (circulating !== null && total !== null && total > 0 && circulating / total > 0.8) {
        return 10;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  private async detectSectorBoost(symbol: string): Promise<number> {
    const keywords = this.resolveSectorKeywords(symbol);
    if (keywords.length === 0) {
      return 0;
    }

    const since = new Date(Date.now() - (48 * 60 * 60 * 1000));
    const newsItems = await this.newsItemRepository.find({
      where: { source: NewsSource.AMBITO },
      order: { publishedAt: 'DESC' },
      take: 50,
    });

    const hits = newsItems.filter((item) => {
      if (item.publishedAt < since) {
        return false;
      }
      const haystack = `${item.title} ${item.summary ?? ''}`.toLowerCase();
      return keywords.some((keyword) => haystack.includes(keyword));
    });

    return hits.length >= 2 ? 15 : 0;
  }

  private resolveSectorKeywords(symbol: string): string[] {
    if (['GGAL', 'BMA', 'BBAR', 'SUPV'].includes(symbol)) {
      return ['bancos', 'credito', 'financiero'];
    }
    if (['YPFD', 'PAMP', 'VIST'].includes(symbol)) {
      return ['energia', 'petroleo', 'gas'];
    }
    if (['TXAR', 'ALUA', 'LOMA', 'HARG'].includes(symbol)) {
      return ['construccion', 'industria', 'infraestructura'];
    }
    return [];
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, Number(value.toFixed(2))));
  }
}
