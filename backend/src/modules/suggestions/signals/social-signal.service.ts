import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { AssetMarket } from '../../../shared/enums';
import { SentimentScore } from '../../sentiment/entities/sentiment-score.entity';
import { ScoreCalculatorService } from '../../sentiment/score-calculator.service';
import { ASSET_NAMES } from '../asset-universe';
import { SocialSignal } from '../suggestions.types';

interface GoogleTrendsResponse {
  default?: {
    trendingSearchesDays?: Array<{
      trendingSearches?: Array<{
        title?: { query?: string };
        relatedQueries?: Array<{ query?: string }>;
      }>;
    }>;
  };
}

interface LunarCrushResponse {
  data?: {
    galaxy_score?: number;
    alt_rank?: number;
    social_volume?: number;
  };
}

@Injectable()
export class SocialSignalService {
  private readonly logger = new Logger(SocialSignalService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly scoreCalculatorService: ScoreCalculatorService,
    @InjectRepository(SentimentScore)
    private readonly sentimentScoreRepository: Repository<SentimentScore>,
  ) {}

  async getScore(symbol: string, market: AssetMarket): Promise<SocialSignal> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const sentimentResult = await this.scoreCalculatorService.buildSentimentResult(normalizedSymbol, market);
    const [trend, googleTrending, lunarData] = await Promise.all([
      this.resolveTrend(normalizedSymbol, market, sentimentResult.score),
      this.isGoogleTrending(normalizedSymbol),
      this.fetchLunarCrush(normalizedSymbol),
    ]);

    let finalScore = sentimentResult.score;
    if (trend === 'RISING') {
      finalScore += 15;
    }
    if (trend === 'FALLING') {
      finalScore -= 10;
    }
    if (googleTrending) {
      finalScore += 20;
    }
    if (typeof lunarData?.data?.galaxy_score === 'number') {
      finalScore = (finalScore + lunarData.data.galaxy_score) / 2;
    }

    return {
      score: this.clamp(finalScore),
      trend,
      mentions: sentimentResult.itemsAnalyzed + (lunarData?.data?.social_volume ?? 0),
      sourceDetails: {
        sentimentScore: sentimentResult.score,
        googleTrending,
        lunarGalaxyScore: lunarData?.data?.galaxy_score ?? null,
        altRank: lunarData?.data?.alt_rank ?? null,
      },
    };
  }

  private async resolveTrend(
    symbol: string,
    market: AssetMarket,
    currentScore: number,
  ): Promise<'RISING' | 'STABLE' | 'FALLING'> {
    const referenceDate = new Date(Date.now() - (24 * 60 * 60 * 1000));
    const previous = await this.sentimentScoreRepository
      .createQueryBuilder('sentiment')
      .where('sentiment.symbol = :symbol', { symbol })
      .andWhere('sentiment.market = :market', { market })
      .andWhere('sentiment.calculated_at <= :referenceDate', { referenceDate: referenceDate.toISOString() })
      .orderBy('sentiment.calculated_at', 'DESC')
      .getOne();

    if (!previous) {
      return 'STABLE';
    }

    const delta = currentScore - previous.score;
    if (delta >= 8) {
      return 'RISING';
    }
    if (delta <= -8) {
      return 'FALLING';
    }
    return 'STABLE';
  }

  private async isGoogleTrending(symbol: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<string>('https://trends.google.com/trends/api/dailytrends', {
          params: { geo: 'AR', hl: 'es' },
          responseType: 'text',
        }),
      );

      const rawData = typeof response.data === 'string' ? response.data.replace(/^\)\]\}',?\n/, '') : '{}';
      const parsed = JSON.parse(rawData) as GoogleTrendsResponse;
      const searchTerms = (parsed.default?.trendingSearchesDays ?? [])
        .flatMap((day) => day.trendingSearches ?? [])
        .flatMap((item) => [
          item.title?.query ?? '',
          ...(item.relatedQueries ?? []).map((query) => query.query ?? ''),
        ])
        .map((term) => term.trim().toUpperCase());

      const assetName = (ASSET_NAMES[symbol] ?? symbol).trim().toUpperCase();
      return searchTerms.some((term) => term.includes(symbol) || term.includes(assetName));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`No se pudo consultar Google Trends para ${symbol}: ${message}`);
      return false;
    }
  }

  private async fetchLunarCrush(symbol: string): Promise<LunarCrushResponse | null> {
    const apiKey = process.env.LUNARCRUSH_API_KEY?.trim();
    if (!apiKey) {
      return null;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<LunarCrushResponse>(`https://lunarcrush.com/api4/public/coins/${symbol}/v1`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }),
      );
      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`LunarCrush no disponible para ${symbol}: ${message}`);
      return null;
    }
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, Number(value.toFixed(2))));
  }
}
