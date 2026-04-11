import { AssetMarket } from '../../../shared/enums';

export interface WealthSnapshot {
  date: Date;
  totalValueUsd: number;
  totalInvested: number;
  pnlUsd: number;
  pnlPct: number;
}

export interface AssetAllocation {
  assetId: string;
  symbol: string;
  name: string;
  market: AssetMarket;
  quantity: number;
  avgCost: number;
  currentPrice: number | null;
  currentValue: number | null;
  totalInvested: number;
  pnlUsd: number | null;
  pnlPct: number | null;
  portfolioPct: number | null;
}

export interface MarketAllocation {
  market: AssetMarket;
  valueUsd: number | null;
  invested: number;
  pct: number | null;
}

export interface WealthSummary {
  portfolioId: string;
  portfolioName: string;
  totalValueUsd: number | null;
  totalInvested: number;
  totalPnlUsd: number | null;
  totalPnlPct: number | null;
  allTimeHigh: number | null;
  allTimeHighDate: Date | null;
  dayChange: number | null;
  dayChangePct: number | null;
  positions: AssetAllocation[];
  byMarket: MarketAllocation[];
  lastUpdated: Date;
}

export interface PeriodComparison {
  period: string;
  valueStart: number | null;
  valueEnd: number | null;
  changeUsd: number | null;
  changePct: number | null;
  investedStart: number;
  investedEnd: number;
}

export interface StakingMetrics {
  totalRewardsUsd: number;
  rewardsByAsset: Array<{
    symbol: string;
    quantity: number;
    estimatedUsd: number | null;
  }>;
  projectedAnnual: number | null;
  projectedMonthly: number | null;
}

export interface RiskMetrics {
  diversificationScore: number;
  maxConcentration: number;
  maxConcentrationAsset: string;
  assetsCount: number;
  marketsCount: number;
}
