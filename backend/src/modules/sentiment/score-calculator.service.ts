import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, IsNull, Like, MoreThanOrEqual, Not, Repository } from 'typeorm';

import { AssetMarket } from '../../shared/enums';
import { RedisPriceService } from '../ingestion/cache/redis-price.service';
import { NewsItem, NewsSource } from './entities/news-item.entity';
import { SentimentScore } from './entities/sentiment-score.entity';
import { FearGreedSource } from './sources/fear-greed.source';
import { FearGreedData, SentimentResult } from './sentiment.types';

interface ScoreBreakdown {
  totalScore: number;
  newsScore: number;
  communityScore: number;
  fearGreedScore: number;
  trendsScore: number;
  itemsAnalyzed: number;
}

@Injectable()
export class ScoreCalculatorService {
  private readonly logger = new Logger(ScoreCalculatorService.name);

  constructor(
    @InjectRepository(NewsItem)
    private readonly newsItemRepository: Repository<NewsItem>,
    @InjectRepository(SentimentScore)
    private readonly sentimentScoreRepository: Repository<SentimentScore>,
    private readonly redisPriceService: RedisPriceService,
    private readonly fearGreedSource: FearGreedSource,
  ) {}

  async calculateScore(symbol: string, market: AssetMarket): Promise<number> {
    const breakdown = await this.getScoreBreakdown(symbol.trim().toUpperCase(), market);
    return breakdown.totalScore;
  }

  getSignal(score: number): SentimentResult['signal'] {
    if (score >= 75) {
      return 'VERY_BULLISH';
    }

    if (score >= 60) {
      return 'BULLISH';
    }

    if (score >= 40) {
      return 'NEUTRAL';
    }

    if (score >= 25) {
      return 'BEARISH';
    }

    return 'VERY_BEARISH';
  }

  async buildSentimentResult(symbol: string, market: AssetMarket): Promise<SentimentResult> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const calculatedAt = new Date();
    const breakdown = await this.getScoreBreakdown(normalizedSymbol, market);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const headlineWhere: FindOptionsWhere<NewsItem> = {
      isRelevant: true,
      sentiment: Not(IsNull()),
      publishedAt: MoreThanOrEqual(since),
      symbols: Like(`%${normalizedSymbol}%`),
    };

    const [topHeadlines, latestScore] = await Promise.all([
      this.newsItemRepository.find({
        where: headlineWhere,
        order: {
          sentimentScore: 'DESC',
          publishedAt: 'DESC',
        },
        take: 5,
      }),
      this.sentimentScoreRepository.findOne({
        where: {
          symbol: normalizedSymbol,
          market,
          calculatedAt: Between(new Date(calculatedAt.getTime() - 55 * 60 * 1000), calculatedAt),
        },
        order: { calculatedAt: 'DESC' },
      }),
    ]);

    const entity = latestScore
      ? this.sentimentScoreRepository.merge(latestScore, {
          score: breakdown.totalScore,
          newsScore: breakdown.newsScore,
          communityScore: breakdown.communityScore,
          fearGreedScore: breakdown.fearGreedScore,
          trendsScore: breakdown.trendsScore,
          itemsAnalyzed: breakdown.itemsAnalyzed,
          calculatedAt,
        })
      : this.sentimentScoreRepository.create({
          symbol: normalizedSymbol,
          market,
          score: breakdown.totalScore,
          newsScore: breakdown.newsScore,
          communityScore: breakdown.communityScore,
          fearGreedScore: breakdown.fearGreedScore,
          trendsScore: breakdown.trendsScore,
          itemsAnalyzed: breakdown.itemsAnalyzed,
          calculatedAt,
        });

    await this.sentimentScoreRepository.save(entity);

    return {
      symbol: normalizedSymbol,
      market,
      score: breakdown.totalScore,
      signal: this.getSignal(breakdown.totalScore),
      newsScore: breakdown.newsScore,
      communityScore: breakdown.communityScore,
      fearGreedScore: breakdown.fearGreedScore,
      trendsScore: breakdown.trendsScore,
      itemsAnalyzed: breakdown.itemsAnalyzed,
      topHeadlines: topHeadlines.map((item) => ({
        title: item.title,
        sentiment: item.sentiment ?? 'NEUTRAL',
        source: item.source,
        url: item.url,
      })),
      calculatedAt,
    };
  }

  private async getScoreBreakdown(symbol: string, market: AssetMarket): Promise<ScoreBreakdown> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const baseWhere: Omit<FindOptionsWhere<NewsItem>, 'source'> = {
      isRelevant: true,
      sentiment: Not(IsNull()),
      publishedAt: MoreThanOrEqual(since),
      symbols: Like(`%${symbol}%`),
    };

    const [newsItems, communityItems, fearGreedData] = await Promise.all([
      this.newsItemRepository.find({
        where: {
          ...baseWhere,
          source: Not(NewsSource.REDDIT),
        },
      }),
      this.newsItemRepository.find({
        where: {
          ...baseWhere,
          source: NewsSource.REDDIT,
        },
      }),
      this.getFearGreedData(),
    ]);

    const newsScore = this.averageScore(newsItems);
    const communityScore = this.averageScore(communityItems);
    const fearGreedScore =
      market === AssetMarket.CRYPTO && fearGreedData !== null
        ? this.fearGreedSource.convertToScore(fearGreedData.value)
        : 50;
    const trendsScore = 50;
    const totalScore = this.roundScore(
      (newsScore * 0.4) +
        (communityScore * 0.3) +
        (fearGreedScore * 0.2) +
        (trendsScore * 0.1),
    );

    return {
      totalScore,
      newsScore,
      communityScore,
      fearGreedScore,
      trendsScore,
      itemsAnalyzed: newsItems.length + communityItems.length,
    };
  }

  private averageScore(items: NewsItem[]): number {
    const scores = items
      .map((item) => item.sentimentScore)
      .filter((score): score is number => typeof score === 'number');

    if (scores.length === 0) {
      return 50;
    }

    const total = scores.reduce((sum, score) => sum + score, 0);
    return this.roundScore(total / scores.length);
  }

  private async getFearGreedData(): Promise<FearGreedData | null> {
    try {
      const cached = await this.redisPriceService.getRawValue('sentiment:fear_greed');
      if (cached) {
        const parsed = JSON.parse(cached) as {
          value?: number;
          classification?: string;
          timestamp?: string;
        };

        if (typeof parsed.value === 'number') {
          return {
            value: parsed.value,
            classification: parsed.classification ?? 'Unknown',
            timestamp: parsed.timestamp ? new Date(parsed.timestamp) : new Date(),
          };
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`No se pudo leer Fear & Greed cacheado: ${message}`);
    }

    return this.fearGreedSource.fetchFearGreed();
  }

  private roundScore(value: number): number {
    return Number(value.toFixed(2));
  }
}