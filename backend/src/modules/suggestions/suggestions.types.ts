import { AssetMarket } from '../../shared/enums';

export enum SuggestionCategory {
  ESTABLISHED = 'ESTABLISHED',
  EMERGING = 'EMERGING',
  RECOVERY = 'RECOVERY',
  LISTING_SOON = 'LISTING_SOON',
  MACRO_DRIVEN = 'MACRO_DRIVEN',
  TECHNICAL_SETUP = 'TECHNICAL_SETUP',
}

export enum TimeHorizon {
  SHORT_TERM = 'SHORT_TERM',
  MEDIUM_TERM = 'MEDIUM_TERM',
  LONG_TERM = 'LONG_TERM',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH',
}

export interface SignalBreakdown {
  social: { score: number; trend: string; mentions: number };
  technical: { score: number; rsi: number; trend: string; volume: string };
  smartMoney: { score: number; whaleActivity: string; unusualVolume: boolean };
  listing: { score: number; isNew: boolean; listingDate: string | null };
  fundamental: { score: number; marketCap: number | null; githubActivity: number | null };
  macro: { score: number; context: string };
}

export interface SuggestionFilters {
  market?: AssetMarket;
  category?: SuggestionCategory;
  riskLevel?: RiskLevel;
  timeHorizon?: TimeHorizon;
  minScore?: number;
  limit?: number;
}

export interface SocialSignal {
  score: number;
  trend: 'RISING' | 'STABLE' | 'FALLING';
  mentions: number;
  sourceDetails?: Record<string, unknown>;
}

export interface SmartMoneySignal {
  score: number;
  whaleActivity: 'BUYING' | 'SELLING' | 'NEUTRAL' | 'UNAVAILABLE';
  unusualVolume: boolean;
  sourceDetails?: Record<string, unknown>;
}

export interface ListingSignal {
  score: number;
  isNew: boolean;
  listingDate: string | null;
  sourceDetails?: Record<string, unknown>;
}

export interface FundamentalSignal {
  score: number;
  marketCap: number | null;
  githubActivity: number | null;
  sourceDetails?: Record<string, unknown>;
}

export interface TechnicalSignal {
  score: number;
  rsi: number;
  trend: string;
  volume: string;
  atrPct: number | null;
}

export interface MacroSignal {
  score: number;
  context: string;
}
