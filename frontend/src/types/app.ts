export type Mode = 'FREE_TIER' | 'PAID';

export type AssetMarket = 'CRYPTO' | 'STOCK_AR' | 'BOND' | 'FX' | 'STAKING';

export type TransactionType =
  | 'BUY'
  | 'SELL'
  | 'STAKE'
  | 'UNSTAKE'
  | 'REWARD'
  | 'TRANSFER'
  | 'FEE';

export type AlertType =
  | 'PRICE_ABOVE'
  | 'PRICE_BELOW'
  | 'SCORE_ABOVE'
  | 'SENTIMENT_CHANGE'
  | 'PORTFOLIO_PNL'
  | 'TOKEN_LIMIT';

export type NotificationChannel = 'IN_APP' | 'TELEGRAM' | 'EMAIL' | 'ALL';
export type StrategyName = 'HOLDING' | 'STAKING' | 'GRID_BOT' | 'LONG' | 'SHORT';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type SentimentSignal = 'VERY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'VERY_BEARISH';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface PortfolioSummary {
  totalInvested: number;
  totalPositions: number;
  transactions: number;
  portfolioName: string;
  baseCurrency: string;
  createdAt: string;
}

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  baseCurrency: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  summary?: PortfolioSummary;
}

export interface TokenStats {
  provider: string;
  modelString: string;
  versionLabel: string;
  mode: Mode;
  requestsToday: number;
  requestsLimit: number | null;
  tokensSession: number;
  costUsd: number;
  costThisMonth: number;
  monthlyLimit: number;
  limitReached: boolean;
  alertAtPct?: number;
  tokensInputTotal?: number;
  tokensOutputTotal?: number;
}

export interface NotificationItem {
  id: string;
  alertId?: string | null;
  type: string;
  title: string;
  message: string;
  channel?: NotificationChannel;
  isRead?: boolean;
  sentAt?: string | null;
  readAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface NotificationsResponse extends PaginatedResponse<NotificationItem> {
  unread: number;
}

export interface Position {
  assetId?: string;
  asset?: {
    id: string;
    symbol: string;
    name: string;
    market: AssetMarket;
  };
  symbol?: string;
  name?: string;
  market: AssetMarket;
  quantity: number;
  avgCost: number;
  currentPrice: number | null;
  currentPriceArs?: number | null;
  currentValue: number | null;
  currentValueArs?: number | null;
  totalInvested: number;
  pnlUsd?: number | null;
  pnl?: number | null;
  pnlPct?: number | null;
  portfolioPct?: number | null;
}

export interface WealthSummary {
  portfolioId: string;
  portfolioName: string;
  totalValueUsd: number | null;
  totalInvested: number;
  totalPnlUsd: number | null;
  totalPnlPct: number | null;
  allTimeHigh: number | null;
  allTimeHighDate: string | null;
  dayChange: number | null;
  dayChangePct: number | null;
  positions: Position[];
  byMarket: Array<{
    market: AssetMarket;
    valueUsd: number | null;
    invested: number;
    pct: number | null;
  }>;
  lastUpdated: string;
}

export interface WealthChartPoint {
  date: string;
  totalValueUsd: number;
  totalInvested: number;
  pnlUsd: number;
  pnlPct: number;
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

export interface RiskMetrics {
  diversificationScore: number;
  maxConcentration: number;
  maxConcentrationAsset: string;
  assetsCount: number;
  marketsCount: number;
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

export interface Transaction {
  id: string;
  portfolioId: string;
  assetId: string;
  type: TransactionType;
  quantity: number;
  priceUsd: number;
  fee: number;
  totalUsd: number;
  date: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  asset?: {
    symbol: string;
    name: string;
    market: AssetMarket;
  };
}

export interface AlertItem {
  id: string;
  name: string;
  type: AlertType;
  symbol: string | null;
  market: AssetMarket | null;
  threshold: number;
  channel: NotificationChannel;
  telegramChatId: string | null;
  emailAddress: string | null;
  isActive: boolean;
  triggerCount: number;
  lastTriggered: string | null;
  cooldownMin: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiModelInfo {
  provider: string;
  modelString: string;
  versionLabel: string;
  freeTierLimit: number | null;
  freeTierTokensDay: number | null;
  isPrimary: boolean;
}

export interface AiLimitSettings {
  id?: string;
  userId?: string;
  monthlyLimitUsd: number;
  alertAtPct: number;
  blockOnLimit: boolean;
}

export interface FearGreedData {
  value: number;
  classification: string;
  timestamp: string;
}

export interface ImportResponse {
  id?: string;
  status?: string;
  rowsOk?: number;
  rowsError?: number;
  errors?: string[];
  createdAt?: string;
}

export interface HistoricalCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceSnapshot {
  symbol: string;
  market: AssetMarket;
  priceUsd: number | null;
  priceArs?: number | null;
  change24h: number | null;
  volume24h: number | null;
  high24h?: number | null;
  low24h?: number | null;
  marketCap?: number | null;
  lastUpdated: string | null;
}

export interface RSIResult {
  value: number | null;
  signal: 'OVERSOLD' | 'NEUTRAL' | 'OVERBOUGHT';
  message: string | null;
}

export interface MACDResult {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  message: string | null;
}

export interface BollingerResult {
  upper: number | null;
  middle: number | null;
  lower: number | null;
  width: number | null;
  position: 'ABOVE' | 'INSIDE' | 'BELOW';
  message: string | null;
}

export interface ATRResult {
  value: number | null;
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string | null;
}

export interface TrendResult {
  direction: 'UP' | 'DOWN' | 'LATERAL';
  strength: 'WEAK' | 'MODERATE' | 'STRONG';
  days7: number | null;
  days30: number | null;
  days90: number | null;
  message: string | null;
}

export interface TechnicalAnalysis {
  symbol: string;
  market: AssetMarket;
  interval: string;
  rsi: RSIResult;
  macd: MACDResult;
  bollinger: BollingerResult;
  atr: ATRResult;
  trend: TrendResult;
  volume: { current: number; avg20: number | null; relativeVolume: number | null };
  lastPrice: number;
  analyzedAt: string;
}

export interface StrategyScore {
  strategy: StrategyName;
  score: number;
  confidence: Confidence;
}

export interface SentimentResult {
  symbol: string;
  market: AssetMarket;
  score: number;
  signal: SentimentSignal;
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
  calculatedAt: string;
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
  generatedAt: string;
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
  topStrategy: StrategyName;
  topScore: number;
  confidence: Confidence;
  lastAnalyzed: string | null;
}

export interface ARStockPrice {
  symbol: string;
  name: string;
  priceArs: number;
  priceUsd: number | null;
  change24h: number | null;
  change30d?: number | null;
  change6m?: number | null;
  change1y?: number | null;
  volume: number | null;
  market: AssetMarket;
  source: string;
  currency: 'ARS' | 'USD';
  lastUpdated: string;
  note?: string;
}

export interface BondPrice {
  symbol: string;
  name: string;
  priceArs: number | null;
  priceUsd: number | null;
  couponRate: number | null;
  maturityDate: string | null;
  currency: 'ARS' | 'USD';
  lastUpdated: string;
  source?: 'RAVA' | 'AMBITO' | 'FALLBACK';
  note?: string;
}

export interface DolarData {
  oficial: number | null;
  mep: number | null;
  ccl: number | null;
  cripto: number | null;
  blue: number | null;
  lastUpdated: string;
}

export interface MacroData {
  tcOficial: number | null;
  tasaPolitica: number | null;
  inflacionMensual: number | null;
  inflacionAnual: number | null;
  reservasUsd: number | null;
  lastUpdated: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  publishedAt: string;
  fetchedAt: string;
  language: string;
  isRelevant: boolean | null;
  symbols: string[] | null;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | null;
  sentimentScore: number | null;
  intensity: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  aiSummary: string | null;
  processedAt: string | null;
}

export interface NewsResponse {
  data: NewsItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CustomSentimentAnalysis {
  sentiment: string;
  score: number;
  intensity: string;
  summary: string;
}

export type SuggestionCategory =
  | 'ESTABLISHED'
  | 'EMERGING'
  | 'RECOVERY'
  | 'LISTING_SOON'
  | 'MACRO_DRIVEN'
  | 'TECHNICAL_SETUP';

export type TimeHorizon = 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type SuggestionChatRole = 'user' | 'assistant';

export interface SignalBreakdown {
  social: { score: number; trend: string; mentions: number };
  technical: { score: number; rsi: number; trend: string; volume: string };
  smartMoney: { score: number; whaleActivity: string; unusualVolume: boolean };
  listing: { score: number; isNew: boolean; listingDate: string | null };
  fundamental: { score: number; marketCap: number | null; githubActivity: number | null };
  macro: { score: number; context: string };
}

export interface Suggestion {
  id: string;
  symbol: string;
  market: AssetMarket;
  name: string;
  convictionScore: number;
  category: SuggestionCategory;
  timeHorizon: TimeHorizon;
  riskLevel: RiskLevel;
  signals: SignalBreakdown;
  narrative: string;
  catalysts: string[];
  risks: string[];
  priceAtAnalysis: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
  isActive: boolean;
  expiresAt: string;
  calculatedAt: string;
  createdAt: string;
}

export interface EmergingAsset {
  id: string;
  symbol: string;
  name: string;
  market: AssetMarket;
  coingeckoId: string | null;
  discoveredAt: string;
  listingDate: string | null;
  listingExchange: 'BINANCE' | 'BYMA' | 'OTHER' | null;
  marketCap: number | null;
  isActive: boolean;
  source: 'COINGECKO_NEW' | 'BINANCE_LISTING' | 'BYMA_LISTING' | 'MANUAL';
}

export interface SuggestionChatMessage {
  id: string;
  sessionId: string;
  symbol: string | null;
  market: AssetMarket | null;
  role: SuggestionChatRole;
  content: string;
  tokensUsed: number;
  createdAt: string;
}

