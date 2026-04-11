import { AssetMarket } from '../../../shared/enums';

export interface ARStockPrice {
  symbol: string;
  name: string;
  priceArs: number;
  priceUsd: number | null;
  change24h: number | null;
  change30d: number | null;
  change6m: number | null;
  change1y: number | null;
  volume: number | null;
  market: AssetMarket;
  source: string;
  currency: 'ARS' | 'USD';
  lastUpdated: Date;
  note?: string;
}

export interface BondPrice {
  symbol: string;
  name: string;
  priceArs: number | null;
  priceUsd: number | null;
  couponRate: number | null;
  maturityDate: Date | null;
  currency: 'ARS' | 'USD';
  lastUpdated: Date;
  source?: 'RAVA' | 'AMBITO' | 'FALLBACK';
  note?: string;
}

export interface DolarData {
  oficial: number | null;
  mep: number | null;
  ccl: number | null;
  cripto: number | null;
  blue: number | null;
  lastUpdated: Date;
}

export interface MacroData {
  tcOficial: number | null;
  tasaPolitica: number | null;
  inflacionMensual: number | null;
  inflacionAnual: number | null;
  reservasUsd: number | null;
  lastUpdated: Date;
}

