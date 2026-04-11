'use client';

import type { AssetMarket, Position } from '@/types/app';

export interface AssetCatalogOption {
  symbol: string;
  name: string;
  market: AssetMarket;
  tags?: string[];
}

export const ASSET_CATALOG: AssetCatalogOption[] = [
  { symbol: 'BTC', name: 'Bitcoin', market: 'CRYPTO', tags: ['store of value'] },
  { symbol: 'ETH', name: 'Ethereum', market: 'CRYPTO', tags: ['smart contracts'] },
  { symbol: 'USDT', name: 'Tether', market: 'CRYPTO', tags: ['stablecoin'] },
  { symbol: 'USDC', name: 'USD Coin', market: 'CRYPTO', tags: ['stablecoin'] },
  { symbol: 'SOL', name: 'Solana', market: 'CRYPTO' },
  { symbol: 'BNB', name: 'BNB', market: 'CRYPTO' },
  { symbol: 'XRP', name: 'XRP', market: 'CRYPTO' },
  { symbol: 'ADA', name: 'Cardano', market: 'CRYPTO' },
  { symbol: 'DOGE', name: 'Dogecoin', market: 'CRYPTO' },
  { symbol: 'MATIC', name: 'Polygon', market: 'CRYPTO' },
  { symbol: 'LINK', name: 'Chainlink', market: 'CRYPTO' },
  { symbol: 'AVAX', name: 'Avalanche', market: 'CRYPTO' },
  { symbol: 'DOT', name: 'Polkadot', market: 'CRYPTO' },
  { symbol: 'ARB', name: 'Arbitrum', market: 'CRYPTO' },
  { symbol: 'OP', name: 'Optimism', market: 'CRYPTO' },
  { symbol: 'INJ', name: 'Injective', market: 'CRYPTO' },
  { symbol: 'ATOM', name: 'Cosmos', market: 'CRYPTO' },
  { symbol: 'LTC', name: 'Litecoin', market: 'CRYPTO' },
  { symbol: 'GGAL', name: 'Grupo Financiero Galicia', market: 'STOCK_AR', tags: ['acciones ar'] },
  { symbol: 'YPFD', name: 'YPF', market: 'STOCK_AR', tags: ['acciones ar'] },
  { symbol: 'BMA', name: 'Banco Macro', market: 'STOCK_AR', tags: ['acciones ar'] },
  { symbol: 'PAMP', name: 'Pampa Energía', market: 'STOCK_AR', tags: ['acciones ar'] },
  { symbol: 'TXAR', name: 'Ternium Argentina', market: 'STOCK_AR', tags: ['acciones ar'] },
  { symbol: 'ALUA', name: 'Aluar', market: 'STOCK_AR', tags: ['acciones ar'] },
  { symbol: 'BYMA', name: 'BYMA', market: 'STOCK_AR', tags: ['acciones ar'] },
  { symbol: 'SUPV', name: 'Grupo Supervielle', market: 'STOCK_AR', tags: ['acciones ar'] },
  { symbol: 'BBAR', name: 'BBVA Argentina', market: 'STOCK_AR', tags: ['acciones ar'] },
  { symbol: 'VIST', name: 'Vista Energy', market: 'STOCK_AR', tags: ['acciones ar'] },
  { symbol: 'AAPL', name: 'Apple', market: 'STOCK_AR', tags: ['cedear'] },
  { symbol: 'MSFT', name: 'Microsoft', market: 'STOCK_AR', tags: ['cedear'] },
  { symbol: 'NVDA', name: 'NVIDIA', market: 'STOCK_AR', tags: ['cedear'] },
  { symbol: 'AMZN', name: 'Amazon', market: 'STOCK_AR', tags: ['cedear'] },
  { symbol: 'GOOGL', name: 'Alphabet', market: 'STOCK_AR', tags: ['cedear'] },
  { symbol: 'META', name: 'Meta', market: 'STOCK_AR', tags: ['cedear'] },
  { symbol: 'TSLA', name: 'Tesla', market: 'STOCK_AR', tags: ['cedear'] },
  { symbol: 'KO', name: 'Coca-Cola', market: 'STOCK_AR', tags: ['cedear'] },
  { symbol: 'AL30', name: 'Bono AL30', market: 'BOND' },
  { symbol: 'GD30', name: 'Bono GD30', market: 'BOND' },
  { symbol: 'AL35', name: 'Bono AL35', market: 'BOND' },
  { symbol: 'GD35', name: 'Bono GD35', market: 'BOND' },
  { symbol: 'GD41', name: 'Bono GD41', market: 'BOND' },
  { symbol: 'MEP', name: 'Dólar MEP', market: 'FX' },
  { symbol: 'CCL', name: 'Contado con liquidación', market: 'FX' },
  { symbol: 'USDT_STAKING', name: 'USDT Staking', market: 'STAKING' },
  { symbol: 'ETH_STAKING', name: 'ETH Staking', market: 'STAKING' },
  { symbol: 'SOL_STAKING', name: 'SOL Staking', market: 'STAKING' }
];

export function getCatalogByMarket(market: AssetMarket): AssetCatalogOption[] {
  return ASSET_CATALOG.filter((asset) => asset.market === market);
}

export function getAssetOption(symbol: string, market?: AssetMarket): AssetCatalogOption | undefined {
  const upperSymbol = symbol.trim().toUpperCase();
  return ASSET_CATALOG.find((asset) => asset.symbol === upperSymbol && (!market || asset.market === market));
}

export function buildAssetOptionsFromPositions(positions: Position[]): AssetCatalogOption[] {
  const customOptions = positions.map((position) => ({
    symbol: (position.symbol ?? position.asset?.symbol ?? '').toUpperCase(),
    name: position.name ?? position.asset?.symbol ?? '',
    market: position.market,
  }));

  const merged = [...customOptions, ...ASSET_CATALOG].filter((item) => item.symbol);
  const seen = new Set<string>();

  return merged.filter((item) => {
    const key = `${item.market}:${item.symbol}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function getMarketLabel(market: AssetMarket): string {
  switch (market) {
    case 'CRYPTO':
      return 'Cripto';
    case 'STOCK_AR':
      return 'Acciones / CEDEARs';
    case 'BOND':
      return 'Bonos';
    case 'FX':
      return 'FX / Dólar';
    case 'STAKING':
      return 'Staking';
    default:
      return market;
  }
}
