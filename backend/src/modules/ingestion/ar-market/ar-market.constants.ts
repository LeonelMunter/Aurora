import { AssetMarket } from '../../../shared/enums';

export interface BondDefinition {
  symbol: string;
  name: string;
  currency: 'ARS' | 'USD';
  couponRate: number | null;
  maturityDate: string | null;
}

export const BYMA_DELAY_NOTE = 'Precios con delay de 20 min (BYMA)';

export const AR_STOCK_SYMBOLS = [
  'GGAL', 'YPFD', 'BMA', 'PAMP', 'TXAR', 'ALUA', 'BYMA', 'SUPV', 'TECO2', 'LOMA',
  'MIRG', 'HARG', 'COME', 'BOLT', 'MOLI', 'BBAR', 'CRES', 'VIST', 'IRSA', 'PBDA',
] as const;

export const CEDEAR_SYMBOLS = [
  'AAPL', 'GOOGL', 'AMZN', 'MSFT', 'TSLA', 'META', 'NVDA', 'BABA', 'DISN', 'KO',
] as const;

export const ALL_AR_STOCK_SYMBOLS = [...AR_STOCK_SYMBOLS, ...CEDEAR_SYMBOLS] as const;

export const BOND_DEFINITIONS: BondDefinition[] = [
  { symbol: 'AL30', name: 'Bonar 2030', currency: 'USD', couponRate: null, maturityDate: null },
  { symbol: 'GD30', name: 'Global 2030', currency: 'USD', couponRate: null, maturityDate: null },
  { symbol: 'AY24', name: 'Bonar 2024', currency: 'USD', couponRate: null, maturityDate: null },
  { symbol: 'AL35', name: 'Bonar 2035', currency: 'USD', couponRate: null, maturityDate: null },
  { symbol: 'GD35', name: 'Global 2035', currency: 'USD', couponRate: null, maturityDate: null },
  { symbol: 'GD41', name: 'Global 2041', currency: 'USD', couponRate: null, maturityDate: null },
  { symbol: 'GD46', name: 'Global 2046', currency: 'USD', couponRate: null, maturityDate: null },
  { symbol: 'GD38', name: 'Global 2038', currency: 'USD', couponRate: null, maturityDate: null },
  { symbol: 'TX26', name: 'Boncer TX26', currency: 'ARS', couponRate: null, maturityDate: null },
  { symbol: 'TZX26', name: 'Boncer TZX26', currency: 'ARS', couponRate: null, maturityDate: null },
  { symbol: 'T2X5', name: 'Boncer T2X5', currency: 'ARS', couponRate: null, maturityDate: null },
  { symbol: 'YPF', name: 'Obligacion Negociable YPF', currency: 'USD', couponRate: null, maturityDate: null },
  { symbol: 'PAE', name: 'Obligacion Negociable PAE', currency: 'USD', couponRate: null, maturityDate: null },
];

export function isCedearSymbol(symbol: string): boolean {
  return CEDEAR_SYMBOLS.includes(symbol.trim().toUpperCase() as (typeof CEDEAR_SYMBOLS)[number]);
}

export function isArMarketOpen(date = new Date()): boolean {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) {
    return false;
  }

  const hour = date.getUTCHours();
  return hour >= 14 && hour < 20;
}

export function getBondDefinition(symbol: string): BondDefinition | null {
  const normalized = symbol.trim().toUpperCase();
  return BOND_DEFINITIONS.find((bond) => bond.symbol === normalized) ?? null;
}

export function getArAssetMarket(symbol: string): AssetMarket {
  return AssetMarket.STOCK_AR;
}