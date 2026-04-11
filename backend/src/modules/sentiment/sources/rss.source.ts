import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';

import { RSS_FEEDS } from '../sentiment.constants';
import { ISentimentSource, RawNewsItem } from '../sentiment.types';

interface ParsedFeedItem {
  title?: string;
  contentSnippet?: string;
  content?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
}

@Injectable()
export class RssSource implements ISentimentSource {
  readonly name = 'RSS';
  private readonly logger = new Logger(RssSource.name);
  private readonly parser = new Parser<Record<string, never>, ParsedFeedItem>();

  async fetch(): Promise<RawNewsItem[]> {
    const collected = await Promise.all(
      RSS_FEEDS.map(async (feed) => {
        try {
          const parsed = await this.withTimeout(this.parser.parseURL(feed.url), 10_000);

          return (parsed.items ?? [])
            .map<RawNewsItem | null>((item) => {
              if (!item.title || !item.link) {
                return null;
              }

              const publishedRaw = item.isoDate ?? item.pubDate;
              const publishedAt = publishedRaw ? new Date(publishedRaw) : new Date();

              return {
                title: item.title.trim(),
                summary: this.stripHtml(item.contentSnippet ?? item.content ?? ''),
                url: item.link.trim(),
                source: feed.source,
                publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
                language: feed.language,
              };
            })
            .filter((item): item is RawNewsItem => item !== null);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          this.logger.warn(`Fallo RSS ${feed.name}: ${message}`);
          return [];
        }
      }),
    );

    return collected.flat();
  }

  private stripHtml(content: string): string {
    const $ = cheerio.load(content);
    return $.text().replace(/\s+/g, ' ').trim();
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms`)), timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error: unknown) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}