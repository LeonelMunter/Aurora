import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Repository } from 'typeorm';

import { RedisPriceService } from '../ingestion/cache/redis-price.service';
import { NewsItem, NewsSource } from './entities/news-item.entity';
import { RelevanceFilterService } from './relevance-filter.service';
import { ScoreCalculatorService } from './score-calculator.service';
import { WATCHLIST_SYMBOLS } from './sentiment.constants';
import { SentimentAnalyzerService } from './sentiment-analyzer.service';
import { FearGreedSource } from './sources/fear-greed.source';
import { RedditSource } from './sources/reddit.source';
import { RssSource } from './sources/rss.source';
import { RawNewsItem } from './sentiment.types';

@Injectable()
export class SentimentOrchestrator {
  private readonly logger = new Logger(SentimentOrchestrator.name);

  constructor(
    @InjectRepository(NewsItem)
    private readonly newsItemRepository: Repository<NewsItem>,
    private readonly rssSource: RssSource,
    private readonly redditSource: RedditSource,
    private readonly fearGreedSource: FearGreedSource,
    private readonly relevanceFilterService: RelevanceFilterService,
    private readonly sentimentAnalyzerService: SentimentAnalyzerService,
    private readonly scoreCalculatorService: ScoreCalculatorService,
    private readonly redisPriceService: RedisPriceService,
  ) {}

  @Cron('0 */15 * * * *')
  async collectAndFilter(): Promise<void> {
    const [rssItems, redditItems] = await Promise.all([this.rssSource.fetch(), this.redditSource.fetch()]);
    const allItems = this.deduplicateByUrl([...rssItems, ...redditItems]);
    const urls = allItems.map((item) => item.url);
    const existing = urls.length > 0
      ? await this.newsItemRepository.find({
          where: { url: In(urls) },
        })
      : [];
    const existingUrls = new Set(existing.map((item) => item.url));
    const newItems = allItems.filter((item) => !existingUrls.has(item.url));

    if (newItems.length === 0) {
      this.logger.log(`Recolectadas ${allItems.length} noticias, 0 nuevas.`);
      return;
    }

    const entities = this.newsItemRepository.create(
      newItems.map((item) => ({
        title: item.title,
        summary: item.summary || null,
        url: item.url,
        source: this.normalizeSource(item.source),
        publishedAt: item.publishedAt,
        language: item.language === 'es' ? 'es' : 'en',
        isRelevant: null,
        symbols: null,
      })),
    );
    await this.newsItemRepository.save(entities);

    const relevantByUrl = new Set(this.relevanceFilterService.filterByKeywords(newItems).map((item) => item.url));

    await Promise.all(
      entities.map((entity) => {
        const matchingItem = newItems.find((item) => item.url === entity.url);
        const combinedText = `${matchingItem?.title ?? entity.title} ${matchingItem?.summary ?? entity.summary ?? ''}`;
        const symbols = this.relevanceFilterService.extractSymbols(combinedText);

        return this.newsItemRepository.save({
          id: entity.id,
          isRelevant: relevantByUrl.has(entity.url),
          symbols: symbols.length > 0 ? symbols : null,
        });
      }),
    );

    this.logger.log(`Recolectadas ${allItems.length} noticias, ${relevantByUrl.size} relevantes.`);
  }

  @Cron('0 */30 * * * *')
  async analyzePendingNews(): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pending = await this.newsItemRepository.find({
      where: {
        isRelevant: true,
        sentiment: IsNull(),
        publishedAt: MoreThan(since),
      },
      order: { publishedAt: 'DESC' },
      take: 20,
    });

    for (const item of pending) {
      const analysis = await this.sentimentAnalyzerService.analyzeSentiment({
        title: item.title,
        summary: item.summary ?? '',
        url: item.url,
        source: item.source,
        publishedAt: item.publishedAt,
        language: item.language,
      });

      await this.newsItemRepository.save({
        id: item.id,
        sentiment: analysis.sentiment ?? null,
        sentimentScore: analysis.sentimentScore ?? 50,
        intensity: analysis.intensity ?? null,
        symbols: analysis.symbols ?? item.symbols,
        aiSummary: analysis.aiSummary ?? item.summary,
        processedAt: analysis.processedAt ?? new Date(),
      });
    }

    this.logger.log(`Analizadas ${pending.length} noticias.`);
  }

  @Cron('0 * * * *')
  async recalculateScores(): Promise<void> {
    for (const entry of WATCHLIST_SYMBOLS) {
      const result = await this.scoreCalculatorService.buildSentimentResult(entry.symbol, entry.market);
      this.logger.log(`Sentimiento ${entry.symbol}/${entry.market}: ${result.signal} (${result.score}/100)`);
    }
  }

  @Cron('0 */30 * * * *')
  async updateFearGreed(): Promise<void> {
    const fearGreed = await this.fearGreedSource.fetchFearGreed();

    if (!fearGreed) {
      return;
    }

    await this.redisPriceService.setRawValue(
      'sentiment:fear_greed',
      JSON.stringify({
        value: fearGreed.value,
        classification: fearGreed.classification,
        timestamp: fearGreed.timestamp.toISOString(),
      }),
      35 * 60,
    );
  }

  private deduplicateByUrl(items: RawNewsItem[]): RawNewsItem[] {
    const seen = new Set<string>();

    return items.filter((item) => {
      if (seen.has(item.url)) {
        return false;
      }

      seen.add(item.url);
      return true;
    });
  }

  private normalizeSource(source: string): NewsSource {
    switch (source) {
      case NewsSource.COINDESK:
      case NewsSource.COINTELEGRAPH:
      case NewsSource.AMBITO:
      case NewsSource.CRONISTA:
      case NewsSource.REUTERS:
      case NewsSource.REDDIT:
      case NewsSource.TELEGRAM:
        return source;
      default:
        return NewsSource.OTHER;
    }
  }
}