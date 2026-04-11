import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { FindOptionsWhere, MoreThan, Repository } from 'typeorm';

import { AssetMarket } from '../../shared/enums';
import { ALL_UNIVERSE } from './asset-universe';
import { ConvictionEngineService } from './conviction-engine.service';
import { EmergingDetectorService } from './emerging-detector.service';
import { EmergingAsset } from './entities/emerging-asset.entity';
import { Suggestion } from './entities/suggestion.entity';
import { RiskLevel, SuggestionCategory, SuggestionFilters, TimeHorizon } from './suggestions.types';

interface CoinGeckoMarketItem {
  symbol: string;
  market_cap: number | null;
}

@Injectable()
export class SuggestionsService {
  private readonly logger = new Logger(SuggestionsService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly convictionEngineService: ConvictionEngineService,
    private readonly emergingDetectorService: EmergingDetectorService,
    @InjectRepository(Suggestion)
    private readonly suggestionRepository: Repository<Suggestion>,
    @InjectRepository(EmergingAsset)
    private readonly emergingAssetRepository: Repository<EmergingAsset>,
  ) {}

  async hasAnySuggestions(): Promise<boolean> {
    const count = await this.suggestionRepository.count();
    return count > 0;
  }

  async refreshSuggestions(): Promise<void> {
    const universe = await this.buildMonitoredUniverse();
    let activeCount = 0;

    for (let index = 0; index < universe.length; index += 10) {
      const batch = universe.slice(index, index + 10);
      const results = await Promise.allSettled(
        batch.map(async (asset) => {
          const suggestion = await this.convictionEngineService.calculateConviction(asset.symbol, asset.market);
          const convictionScore = suggestion.convictionScore ?? 0;

          if (convictionScore >= 45) {
            await this.suggestionRepository.upsert(
              {
                ...suggestion,
                symbol: asset.symbol,
                market: asset.market,
                isActive: true,
              },
              ['symbol', 'market'],
            );
            activeCount += 1;
            return;
          }

          const existing = await this.suggestionRepository.findOne({
            where: { symbol: asset.symbol, market: asset.market },
          });

          if (existing) {
            await this.suggestionRepository.save({
              ...existing,
              ...suggestion,
              isActive: false,
              convictionScore,
            });
          }
        }),
      );

      results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .forEach((result) => {
          const message = result.reason instanceof Error ? result.reason.message : 'Error desconocido';
          this.logger.warn(`Fallo calculando sugerencia: ${message}`);
        });

      if (index + 10 < universe.length) {
        await this.delay(1000);
      }
    }

    this.logger.log(`${activeCount} sugerencias activas generadas`);
  }

  async getSuggestions(filters: SuggestionFilters): Promise<Suggestion[]> {
    const where: FindOptionsWhere<Suggestion> = { isActive: true };
    if (filters.market) {
      where.market = filters.market;
    }
    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.riskLevel) {
      where.riskLevel = filters.riskLevel;
    }
    if (filters.timeHorizon) {
      where.timeHorizon = filters.timeHorizon;
    }

    const query = this.suggestionRepository.createQueryBuilder('suggestion').where(where);
    if (typeof filters.minScore === 'number') {
      query.andWhere('suggestion.conviction_score >= :minScore', { minScore: filters.minScore });
    }

    return query.orderBy('suggestion.conviction_score', 'DESC').take(filters.limit ?? 20).getMany();
  }

  async getSuggestionDetail(symbol: string, market: AssetMarket): Promise<Suggestion | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const existing = await this.suggestionRepository.findOne({
      where: { symbol: normalizedSymbol, market },
    });

    if (existing && existing.calculatedAt.getTime() < Date.now() - (4 * 60 * 60 * 1000)) {
      void this.refreshSingleSuggestion(normalizedSymbol, market);
    }

    return existing;
  }

  async getTopSuggestions(limit = 10): Promise<Suggestion[]> {
    return this.suggestionRepository.find({
      where: { isActive: true },
      order: { convictionScore: 'DESC' },
      take: limit,
    });
  }

  async getSuggestionsByCategory(): Promise<Record<string, Suggestion[]>> {
    const suggestions = await this.getSuggestions({ limit: 100 });
    const grouped = Object.values(SuggestionCategory).reduce<Record<string, Suggestion[]>>((acc, category) => {
      acc[category] = [];
      return acc;
    }, {});

    for (const suggestion of suggestions) {
      grouped[suggestion.category] ??= [];
      grouped[suggestion.category].push(suggestion);
    }

    return grouped;
  }

  async refreshHighPrioritySuggestions(): Promise<void> {
    const highScoreSuggestions = await this.suggestionRepository.find({
      where: {
        isActive: true,
        convictionScore: MoreThan(70),
      },
      order: { convictionScore: 'DESC' },
      take: 25,
    });
    const emergingAssets = await this.emergingDetectorService.getEmergingAssets();
    const listingSoon = await this.suggestionRepository.find({
      where: {
        isActive: true,
        category: SuggestionCategory.LISTING_SOON,
      },
      take: 25,
    });

    const assets = new Map<string, { symbol: string; market: AssetMarket }>();
    for (const suggestion of highScoreSuggestions) {
      assets.set(`${suggestion.symbol}:${suggestion.market}`, { symbol: suggestion.symbol, market: suggestion.market });
    }
    for (const suggestion of listingSoon) {
      assets.set(`${suggestion.symbol}:${suggestion.market}`, { symbol: suggestion.symbol, market: suggestion.market });
    }
    for (const asset of emergingAssets) {
      assets.set(`${asset.symbol}:${asset.market}`, { symbol: asset.symbol, market: asset.market });
    }

    await Promise.allSettled(
      Array.from(assets.values()).map((asset) => this.refreshSingleSuggestion(asset.symbol, asset.market)),
    );
  }

  private async refreshSingleSuggestion(symbol: string, market: AssetMarket): Promise<void> {
    const suggestion = await this.convictionEngineService.calculateConviction(symbol, market);
    await this.suggestionRepository.upsert(
      {
        ...suggestion,
        symbol,
        market,
        isActive: (suggestion.convictionScore ?? 0) >= 45,
      },
      ['symbol', 'market'],
    );
  }

  private async buildMonitoredUniverse(): Promise<Array<{ symbol: string; market: AssetMarket }>> {
    const dynamicMidCaps = await this.fetchDynamicMidCapUniverse();
    const emergingAssets = await this.emergingAssetRepository.find({
      where: { isActive: true, market: AssetMarket.CRYPTO },
      order: { discoveredAt: 'DESC' },
      take: 100,
    });

    const deduped = new Map<string, { symbol: string; market: AssetMarket }>();
    for (const asset of ALL_UNIVERSE) {
      deduped.set(`${asset.symbol}:${asset.market}`, asset);
    }
    for (const symbol of dynamicMidCaps) {
      deduped.set(`${symbol}:${AssetMarket.CRYPTO}`, { symbol, market: AssetMarket.CRYPTO });
    }
    for (const asset of emergingAssets) {
      deduped.set(`${asset.symbol}:${asset.market}`, { symbol: asset.symbol, market: asset.market });
    }

    return Array.from(deduped.values());
  }

  private async fetchDynamicMidCapUniverse(): Promise<string[]> {
    try {
      const apiUrl = process.env.COINGECKO_API_URL ?? 'https://api.coingecko.com/api/v3';
      const requests = [1, 2].map((page) =>
        firstValueFrom(
          this.httpService.get<CoinGeckoMarketItem[]>(`${apiUrl}/coins/markets`, {
            params: {
              vs_currency: 'usd',
              order: 'market_cap_desc',
              per_page: 100,
              page,
              sparkline: false,
            },
          }),
        ),
      );

      const responses = await Promise.all(requests);
      return responses
        .flatMap((response) => response.data)
        .slice(49, 200)
        .filter((coin) => (coin.market_cap ?? 0) > 100000000)
        .map((coin) => coin.symbol.toUpperCase());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`No se pudo construir universo mid-cap dinamico: ${message}`);
      return [];
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
