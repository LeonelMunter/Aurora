'use client';

import { Suspense, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { MarketAssetCard } from '@/components/market/MarketAssetCard';
import { Badge } from '@/components/ui/Badge';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { StatCard } from '@/components/ui/StatCard';
import { apiClient } from '@/lib/axios';
import { formatCurrency } from '@/lib/format';
import type { ARStockPrice, DolarData, MacroData, MarketOverview } from '@/types/app';

const cedears = new Set(['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'META', 'KO']);
const PAGE_SIZE = 8;

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function sortStocks(data: ARStockPrice[], overviewMap: Map<string, MarketOverview>, key: 'priceArs' | 'change24h' | 'score') {
  return [...data].sort((left, right) => {
    if (key === 'priceArs') return (right.priceArs ?? 0) - (left.priceArs ?? 0);
    if (key === 'change24h') return (right.change24h ?? 0) - (left.change24h ?? 0);
    return (overviewMap.get(right.symbol)?.topScore ?? 0) - (overviewMap.get(left.symbol)?.topScore ?? 0);
  });
}

function AccionesArPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'priceArs' | 'change24h' | 'score'>('score');

  const updateQueryParams = useMemo(() => {
    return (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    };
  }, [pathname, router, searchParams]);

  const localPageParam = searchParams.get('localPage');
  const cedearPageParam = searchParams.get('cedearPage');

  const stocksQuery = useQuery({
    queryKey: ['acciones-ar-stocks'],
    queryFn: async () => {
      const [stocks, overview] = await Promise.all([
        apiClient.get<ARStockPrice[]>('/market/ar/stocks'),
        apiClient.get<MarketOverview[]>('/analysis/overview/stocks-ar'),
      ]);
      return { stocks: stocks.data, overview: overview.data };
    },
    staleTime: 30000,
  });

  const macroQuery = useQuery({
    queryKey: ['acciones-ar-macro'],
    queryFn: async () => {
      const [macro, dolar] = await Promise.all([
        apiClient.get<MacroData>('/market/ar/macro'),
        apiClient.get<DolarData>('/market/ar/dolar'),
      ]);
      return { macro: macro.data, dolar: dolar.data };
    },
    staleTime: 60000,
  });

  if (stocksQuery.isLoading || macroQuery.isLoading) {
    return <div className="space-y-6 animate-pulse"><div className="h-20 rounded-3xl bg-slate-900/70" /><div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-[2rem] bg-slate-900/70" />)}</div><div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[420px] rounded-[2rem] bg-slate-900/70" />)}</div></div>;
  }

  if (stocksQuery.isError || macroQuery.isError) {
    return <ErrorMessage message="No pudimos cargar acciones argentinas." retry={() => { stocksQuery.refetch(); macroQuery.refetch(); }} />;
  }

  const overviewMap = new Map((stocksQuery.data?.overview ?? []).map((item) => [item.symbol, item]));
  const filteredStocks = (stocksQuery.data?.stocks ?? []).filter((item) => item.symbol.toLowerCase().includes(search.toLowerCase()) || item.name.toLowerCase().includes(search.toLowerCase()));
  const stocks = sortStocks(filteredStocks, overviewMap, sortBy);
  const cedearRows = stocks.filter((item) => cedears.has(item.symbol));
  const localRows = stocks.filter((item) => !cedears.has(item.symbol));
  const localTotalPages = Math.max(1, Math.ceil(localRows.length / PAGE_SIZE));
  const cedearTotalPages = Math.max(1, Math.ceil(cedearRows.length / PAGE_SIZE));
  const localPage = Math.min(parsePage(localPageParam), localTotalPages);
  const cedearPage = Math.min(parsePage(cedearPageParam), cedearTotalPages);
  const paginatedLocal = localRows.slice((localPage - 1) * PAGE_SIZE, localPage * PAGE_SIZE);
  const paginatedCedears = cedearRows.slice((cedearPage - 1) * PAGE_SIZE, cedearPage * PAGE_SIZE);

  return (
    <div className="space-y-8">
      <PageHeader title="Acciones y CEDEARs argentinos" subtitle="Exploración visual por cards para renta variable local y papeles dolarizados." actions={<Badge label="Precios con delay de 20 min (BYMA)" variant="warning" />} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="TC Oficial" value={macroQuery.data?.macro.tcOficial} prefix="$" />
        <StatCard label="Dólar MEP" value={macroQuery.data?.dolar.mep} prefix="$" />
        <StatCard label="Inflación mensual" value={macroQuery.data?.macro.inflacionMensual} prefix="%" />
        <StatCard label="Tasa política monetaria" value={macroQuery.data?.macro.tasaPolitica} prefix="%" />
      </section>

      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              updateQueryParams({ localPage: '1', cedearPage: '1' });
            }}
            placeholder="Buscar símbolo o nombre"
            className="min-w-[240px] rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white"
          />
          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as 'priceArs' | 'change24h' | 'score');
              updateQueryParams({ localPage: '1', cedearPage: '1' });
            }}
            className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white"
          >
            <option value="score">Score operativo</option>
            <option value="change24h">Variación 24h</option>
            <option value="priceArs">Precio ARS</option>
          </select>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/70 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Panel local</h2>
            <p className="mt-1 text-sm text-slate-400">Acciones argentinas con ARS, USD, 24h, 6M, 1Y y score integrado.</p>
          </div>
          <Badge label={`${localRows.length} activos`} variant="info" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {paginatedLocal.map((stock) => {
            const overview = overviewMap.get(stock.symbol);
            return (
              <MarketAssetCard
                key={stock.symbol}
                href={`/mercado-ar/${encodeURIComponent(stock.symbol)}`}
                symbol={stock.symbol}
                name={stock.name}
                marketLabel="Acciones AR"
                pricePrimary={formatCurrency(stock.priceArs).replace('$', '$ARS ')}
                priceSecondary={stock.priceUsd !== null ? `Referencia USD ${formatCurrency(stock.priceUsd)}` : undefined}
                change24h={stock.change24h}
                change6m={stock.change6m}
                change1y={stock.change1y}
                topStrategy={overview?.topStrategy ?? null}
                topScore={overview?.topScore ?? null}
                sourceLabel={stock.source}
              />
            );
          })}
        </div>
        <PaginationControls page={localPage} totalPages={localTotalPages} onPageChange={(page) => updateQueryParams({ localPage: String(page) })} />
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/70 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-white">CEDEARs</h2>
            <p className="mt-1 text-sm text-slate-400">Mismo formato visual para análisis rápido y acceso al detalle por activo.</p>
          </div>
          <Badge label="CCL" variant="info" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {paginatedCedears.map((stock) => {
            const overview = overviewMap.get(stock.symbol);
            return (
              <MarketAssetCard
                key={stock.symbol}
                href={`/mercado-ar/${encodeURIComponent(stock.symbol)}`}
                symbol={stock.symbol}
                name={stock.name}
                marketLabel="Cedear"
                pricePrimary={formatCurrency(stock.priceArs).replace('$', '$ARS ')}
                priceSecondary={stock.priceUsd !== null ? `Referencia USD ${formatCurrency(stock.priceUsd)}` : undefined}
                change24h={stock.change24h}
                change6m={stock.change6m}
                change1y={stock.change1y}
                topStrategy={overview?.topStrategy ?? null}
                topScore={overview?.topScore ?? null}
                sourceLabel={stock.source}
              />
            );
          })}
        </div>
        <PaginationControls page={cedearPage} totalPages={cedearTotalPages} onPageChange={(page) => updateQueryParams({ cedearPage: String(page) })} />
      </section>
    </div>
  );
}

export default function AccionesArPage() {
  return (
    <Suspense fallback={<div className="h-32 animate-pulse rounded-[2rem] bg-slate-900/70" />}>
      <AccionesArPageContent />
    </Suspense>
  );
}
