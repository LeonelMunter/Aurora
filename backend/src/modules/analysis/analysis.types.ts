import { AssetMarket } from '../../shared/enums';

export interface OHLCV {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
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
  analyzedAt: Date;
}

export interface HistoricalPerformance {
  change7d: number | null;
  change30d: number | null;
  change6m: number | null;
  change1y: number | null;
}
