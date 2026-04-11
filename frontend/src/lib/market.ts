import type { AssetMarket } from '@/types/app';

export function buildMarketDetailHref(
  symbol: string,
  market: AssetMarket,
  params?: Record<string, string | number | null | undefined>,
): string {
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (market === 'STOCK_AR') {
    return `/mercado-ar/${encodeURIComponent(normalizedSymbol)}`;
  }

  const searchParams = new URLSearchParams({ market });

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  return `/mercado/${encodeURIComponent(normalizedSymbol)}?${searchParams.toString()}`;
}
