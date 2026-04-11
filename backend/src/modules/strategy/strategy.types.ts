import { AssetMarket } from '../../shared/enums';
import { SentimentResult } from '../sentiment/sentiment.types';

export interface StrategyScore {
  strategy: 'HOLDING' | 'STAKING' | 'GRID_BOT' | 'LONG' | 'SHORT';
  score: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface StrategyRecommendation {
  symbol: string;
  market: AssetMarket;
  topStrategy: StrategyScore;
  allScores: StrategyScore[];
  reasoning: string[];
  entryPrice: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
  riskReward: number | null;
  suggestedCapital: {
    min: number;
    recommended: number;
  };
  sentiment?: SentimentResult;
  generatedAt: Date;
}

export interface MarketOverview {
  symbol: string;
  market: AssetMarket;
  priceUsd: number | null;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  change6m: number | null;
  change1y: number | null;
  topStrategy: string;
  topScore: number;
  confidence: string;
  lastAnalyzed: Date | null;
}
