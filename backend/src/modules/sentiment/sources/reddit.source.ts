import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { SUBREDDITS } from '../sentiment.constants';
import { ISentimentSource, RawNewsItem } from '../sentiment.types';

interface RedditListingResponse {
  data?: {
    children?: Array<{
      data?: {
        title?: string;
        selftext?: string;
        url?: string;
        permalink?: string;
        created_utc?: number;
      };
    }>;
  };
}

@Injectable()
export class RedditSource implements ISentimentSource {
  readonly name = 'REDDIT';
  private readonly logger = new Logger(RedditSource.name);

  constructor(private readonly httpService: HttpService) {}

  async fetch(): Promise<RawNewsItem[]> {
    const batches = await Promise.all(
      SUBREDDITS.map(async (subreddit) => {
        try {
          const response = await firstValueFrom(
            this.httpService.get<RedditListingResponse>(`https://www.reddit.com/r/${subreddit.name}/hot.json`, {
              params: {
                limit: 25,
                t: 'day',
              },
              headers: {
                'User-Agent': 'AuroraFinance/1.0',
              },
              timeout: 10_000,
            }),
          );

          return (response.data.data?.children ?? [])
            .map<RawNewsItem | null>((entry) => {
              const post = entry.data;
              if (!post?.title || !(post.url ?? post.permalink)) {
                return null;
              }

              const url = post.url?.startsWith('http')
                ? post.url
                : `https://www.reddit.com${post.permalink ?? ''}`;

              return {
                title: post.title.trim(),
                summary: (post.selftext ?? '').slice(0, 500).trim(),
                url,
                source: 'REDDIT',
                publishedAt: new Date((post.created_utc ?? Date.now() / 1000) * 1000),
                language: subreddit.language,
              };
            })
            .filter((item): item is RawNewsItem => item !== null);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          this.logger.warn(`Fallo Reddit r/${subreddit.name}: ${message}`);
          return [];
        }
      }),
    );

    return batches.flat();
  }
}