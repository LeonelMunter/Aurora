export type AssetMarket = 'CRYPTO' | 'STOCK_AR' | 'BOND' | 'FX' | 'STAKING';
export type AssetSearchMarket = AssetMarket | 'ALL' | 'CEDEARS';
export type SimulatorMode = 'SPOT' | 'FUTUROS';
export type SimStrategy = 'HOLDING' | 'GRID_BOT' | 'DCA' | 'LONG' | 'SHORT' | 'STAKING';

export interface SimulatorConfig {
  symbol: string;
  market: AssetMarket;
  strategy: SimStrategy;
  capital: number;
  startDate: string;
  endDate: string;
  holdingParams?: {
    entryPrice?: number;
  };
  gridParams?: {
    rangeMin?: number;
    rangeMax?: number;
    gridCount?: number;
    useAutoRange?: boolean;
  };
  dcaParams?: {
    intervalDays?: number;
    amountPerBuy?: number;
  };
  tradeParams?: {
    entryPrice?: number;
    targetPrice?: number;
    stopLoss?: number;
    leverage?: number;
    liquidationPrice?: number;
    marginRequired?: number;
  };
  stakingParams?: {
    apyPct?: number;
  };
}

export interface SimulatorCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface GridOrder {
  price: number;
  type: 'BUY' | 'SELL';
  executedAt: number;
  quantity: number;
  profit: number;
}

export interface DailyPortfolioValue {
  date: string;
  portfolioValue: number;
  capitalInvested: number;
  pnlUsd: number;
  pnlPct: number;
  price: number;
  ordersExecuted?: number;
}

export interface SimulatorTradeResult {
  entryDate: string;
  exitDate: string | null;
  exitPrice: number | null;
  result: 'TARGET_HIT' | 'STOP_HIT' | 'OPEN' | 'LIQUIDATED';
  leverageUsed?: number;
  liquidationPrice?: number;
  marginRequired?: number;
  wasLiquidated?: boolean;
  liquidationDate?: string | null;
}

export interface SimulatorResult {
  config: SimulatorConfig;
  strategy: SimStrategy;
  symbol: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  initialCapital: number;
  finalValue: number;
  totalPnlUsd: number;
  totalPnlPct: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  totalFees: number;
  portfolioHistory: DailyPortfolioValue[];
  gridOrders?: GridOrder[];
  dcaBuys?: Array<{
    date: string;
    price: number;
    quantity: number;
    totalInvested: number;
  }>;
  tradeResult?: SimulatorTradeResult;
  priceHistory: SimulatorCandle[];
  holdingComparison?: {
    finalValue: number;
    pnlPct: number;
    betterThan: boolean;
  };
}

export interface AssetSearchResult {
  symbol: string;
  name: string;
  market: AssetMarket;
  currentPrice: number | null;
}
