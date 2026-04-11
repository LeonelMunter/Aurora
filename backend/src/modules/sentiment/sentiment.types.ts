import { AssetMarket } from '../../shared/enums';

export interface RawNewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Date;
  language: string;
}

export interface FearGreedData {
  value: number;
  classification: string;
  timestamp: Date;
}

export interface SentimentResult {
  symbol: string;
  market: AssetMarket;
  score: number;
  signal: 'VERY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'VERY_BEARISH';
  newsScore: number | null;
  communityScore: number | null;
  fearGreedScore: number | null;
  trendsScore: number | null;
  itemsAnalyzed: number;
  topHeadlines: Array<{
    title: string;
    sentiment: string;
    source: string;
    url: string;
  }>;
  calculatedAt: Date;
}

export interface ISentimentSource {
  name: string;
  fetch(): Promise<RawNewsItem[]>;
}