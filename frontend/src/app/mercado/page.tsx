'use client';

import { Suspense, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { MarketAssetCard } from '@/components/market/MarketAssetCard';
import { Badge } from '@/components/ui/Badge';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { apiClient } from '@/lib/axios';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';
import { buildMarketDetailHref } from '@/lib/market';
import { useAppStore } from '@/store/useAppStore';
import type { ARStockPrice, BondPrice, DolarData, MarketOverview } from '@/types/app';

const tabs = ['Cripto', 'Acciones AR', 'Bonos', 'Dolar'] as const;
type MarketTab = (typeof tabs)[number];
const PAGE_SIZE = 8;

function MarketSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex gap-3">
        {tabs.map((tab) => (
          <div key={tab} className="h-11 w-28 rounded-full bg-slate-900/70" />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-[420px] rounded-[2rem] bg-slate-900/70" />
        ))}
      </div>
    </div>
  );
}

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function marketLabel(symbol: string): string {
  const cedears = new Set(['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'META', 'KO']);
  return cedears.has(symbol) ? 'Cedear' : 'Acciones AR';
}

function MercadoPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<MarketTab>('Cripto');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'change' | 'score'>('score');
  const livePrices = useAppStore((state) => state.prices);

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

  const cryptoPageParam = searchParams.get('cryptoPage');
  const stocksPageParam = searchParams.get('stocksPage');
  const bondsPageParam = searchParams.get('bondsPage');

  const cryptoQuery = useQuery({
    queryKey: ['analysis-overview-crypto'],
    queryFn: async () => {
      const { data } = await apiClient.get<MarketOverview[]>('/analysis/overview/crypto');
      return data;
    },
    staleTime: 30000,
  });

  const stocksQuery = useQuery({
    queryKey: ['market-stocks-overview'],
    queryFn: async () => {
      const [stocks, overview] = await Promise.all([
        apiClient.get<ARStockPrice[]>('/market/ar/stocks'),
        apiClient.get<MarketOverview[]>('/analysis/overview/stocks-ar'),
      ]);
      return { stocks: stocks.data, overview: overview.data };
    },
    staleTime: 30000,
  });

  const bondsQuery = useQuery({
    queryKey: ['market-bonds'],
    queryFn: async () => {
      const { data } = await apiClient.get<BondPrice[]>('/market/ar/bonds');
      return data;
    },
    staleTime: 60000,
  });

  const dolarQuery = useQuery({
    queryKey: ['market-dolar'],
    queryFn: async () => {
      const { data } = await apiClient.get<DolarData>('/market/ar/dolar');
      return data;
    },
    staleTime: 60000,
  });

  if (cryptoQuery.isLoading || stocksQuery.isLoading || bondsQuery.isLoading || dolarQuery.isLoading) {
    return (
      <div>
        <PageHeader
          title="Mercado"
          subtitle="Seguimiento publico de oportunidades, precios y contexto macro con acceso directo al detalle de cada activo."
        />
        <MarketSkeleton />
      </div>
    );
  }

  if (cryptoQuery.isError || stocksQuery.isError || bondsQuery.isError || dolarQuery.isError) {
    return (
      <ErrorMessage
        message="No pudimos cargar el overview del mercado."
        retry={() => {
          cryptoQuery.refetch();
          stocksQuery.refetch();
          bondsQuery.refetch();
          dolarQuery.refetch();
        }}
      />
    );
  }

  const filteredCrypto = [...(cryptoQuery.data ?? [])]
    .filter((item) => item.symbol.toLowerCase().includes(search.toLowerCase()))
    .sort((left, right) => {
      if (sortBy === 'price') return (right.priceUsd ?? 0) - (left.priceUsd ?? 0);
      if (sortBy === 'change') return (right.change24h ?? 0) - (left.change24h ?? 0);
      return (right.topScore ?? 0) - (left.topScore ?? 0);
    });

  const stocksOverviewMap = new Map((stocksQuery.data?.overview ?? []).map((item) => [item.symbol, item]));
  const filteredStocks = [...(stocksQuery.data?.stocks ?? [])]
    .filter((item) => {
      const term = search.toLowerCase();
      return item.symbol.toLowerCase().includes(term) || item.name.toLowerCase().includes(term);
    })
    .sort((left, right) => {
      if (sortBy === 'price') return (right.priceArs ?? 0) - (left.priceArs ?? 0);
      if (sortBy === 'change') return (right.change24h ?? 0) - (left.change24h ?? 0);
      return (stocksOverviewMap.get(right.symbol)?.topScore ?? 0) - (stocksOverviewMap.get(left.symbol)?.topScore ?? 0);
    });

  const filteredBonds = [...(bondsQuery.data ?? [])]
    .filter((item) => {
      const term = search.toLowerCase();
      return item.symbol.toLowerCase().includes(term) || item.name.toLowerCase().includes(term);
    })
    .sort((left, right) => {
      if (sortBy === 'price') return (right.priceArs ?? 0) - (left.priceArs ?? 0);
      return (right.priceUsd ?? 0) - (left.priceUsd ?? 0);
    });

  const cryptoTotalPages = Math.max(1, Math.ceil(filteredCrypto.length / PAGE_SIZE));
  const stocksTotalPages = Math.max(1, Math.ceil(filteredStocks.length / PAGE_SIZE));
  const bondsTotalPages = Math.max(1, Math.ceil(filteredBonds.length / PAGE_SIZE));

  const cryptoPage = Math.min(parsePage(cryptoPageParam), cryptoTotalPages);
  const stocksPage = Math.min(parsePage(stocksPageParam), stocksTotalPages);
  const bondsPage = Math.min(parsePage(bondsPageParam), bondsTotalPages);

  const paginatedCrypto = filteredCrypto.slice((cryptoPage - 1) * PAGE_SIZE, cryptoPage * PAGE_SIZE);
  const paginatedStocks = filteredStocks.slice((stocksPage - 1) * PAGE_SIZE, stocksPage * PAGE_SIZE);
  const paginatedBonds = filteredBonds.slice((bondsPage - 1) * PAGE_SIZE, bondsPage * PAGE_SIZE);

  const dolar = dolarQuery.data;
  const gap = dolar?.oficial && dolar?.mep ? ((dolar.mep - dolar.oficial) / dolar.oficial) * 100 : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mercado"
        subtitle="Seguimiento publico de oportunidades, precios y contexto macro con acceso directo al detalle de cada activo."
      />

      <div className="flex flex-wrap items-center gap-3">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === item ? 'bg-cyan-500 text-slate-950' : 'border border-slate-700 bg-slate-900/70 text-slate-300'
            }`}
          >
            {item}
          </button>
        ))}

        {tab !== 'Dolar' ? (
          <>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                updateQueryParams({ cryptoPage: '1', stocksPage: '1', bondsPage: '1' });
              }}
              placeholder="Buscar simbolo o nombre"
              className="ml-auto min-w-[240px] rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
            />
            <select
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value as 'price' | 'change' | 'score');
                updateQueryParams({ cryptoPage: '1', stocksPage: '1', bondsPage: '1' });
              }}
              className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
            >
              <option value="score">Ordenar por score</option>
              <option value="price">Ordenar por precio</option>
              <option value="change">Ordenar por cambio</option>
            </select>
          </>
        ) : null}
      </div>

      {tab === 'Cripto' ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/70 px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-white">Radar cripto</h2>
              <p className="mt-1 text-sm text-slate-400">Cards navegables con score, variacion 24h, 6M y 1Y.</p>
            </div>
            <Badge label={`${filteredCrypto.length} activos`} variant="info" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {paginatedCrypto.map((item) => (
              <MarketAssetCard
                key={item.symbol}
                href={buildMarketDetailHref(item.symbol, 'CRYPTO')}
                symbol={item.symbol}
                name={item.symbol}
                marketLabel="Cripto"
                pricePrimary={formatCurrency(livePrices.get(item.symbol) ?? item.priceUsd)}
                change24h={item.change24h}
                change6m={item.change6m}
                change1y={item.change1y}
                topStrategy={item.topStrategy}
                topScore={item.topScore}
              />
            ))}
          </div>
          <PaginationControls page={cryptoPage} totalPages={cryptoTotalPages} onPageChange={(page) => updateQueryParams({ cryptoPage: String(page) })} />
        </section>
      ) : null}

      {tab === 'Acciones AR' ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/70 px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-white">Mercado local y cedears</h2>
              <p className="mt-1 text-sm text-slate-400">Cada card conserva precio ARS/USD, cambio 24h y score operativo.</p>
            </div>
            <Badge label="BYMA con delay" variant="warning" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {paginatedStocks.map((item) => {
              const overview = stocksOverviewMap.get(item.symbol);
              return (
                <MarketAssetCard
                  key={item.symbol}
                  href={buildMarketDetailHref(item.symbol, 'STOCK_AR')}
                  symbol={item.symbol}
                  name={item.name}
                  marketLabel={marketLabel(item.symbol)}
                  pricePrimary={formatCurrency(item.priceArs).replace('$', '$ARS ')}
                  priceSecondary={item.priceUsd !== null ? `Referencia USD ${formatCurrency(item.priceUsd)}` : undefined}
                  change24h={item.change24h}
                  change6m={item.change6m}
                  change1y={item.change1y}
                  topStrategy={overview?.topStrategy ?? null}
                  topScore={overview?.topScore ?? null}
                  sourceLabel={item.source}
                />
              );
            })}
          </div>
          <PaginationControls page={stocksPage} totalPages={stocksTotalPages} onPageChange={(page) => updateQueryParams({ stocksPage: String(page) })} />
        </section>
      ) : null}

      {tab === 'Bonos' ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/70 px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-white">Bonos y deuda soberana</h2>
              <p className="mt-1 text-sm text-slate-400">Vista en cards para explorar simbolo, paridad referencial y moneda.</p>
            </div>
            <Badge label={`${filteredBonds.length} instrumentos`} variant="neutral" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {paginatedBonds.map((bond) => (
              <MarketAssetCard
                key={bond.symbol}
                href={buildMarketDetailHref(bond.symbol, 'BOND')}
                symbol={bond.symbol}
                name={bond.name}
                marketLabel="Bonos"
                pricePrimary={bond.priceArs !== null ? formatCurrency(bond.priceArs).replace('$', '$ARS ') : 'Sin precio ARS'}
                priceSecondary={bond.priceUsd !== null ? `Paridad USD ${formatCurrency(bond.priceUsd)}` : undefined}
                sourceLabel={bond.source ?? bond.currency}
                note={bond.note ?? `Moneda ${bond.currency}`}
              />
            ))}
          </div>
          <PaginationControls page={bondsPage} totalPages={bondsTotalPages} onPageChange={(page) => updateQueryParams({ bondsPage: String(page) })} />
        </section>
      ) : null}

      {tab === 'Dolar' && dolar ? (
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {(['oficial', 'mep', 'ccl', 'cripto', 'blue'] as const).map((key) => (
              <article key={key} className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5">
                <p className="text-sm capitalize text-slate-400">{key}</p>
                <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(dolar[key])}</p>
                <p className="mt-2 text-xs text-slate-500">Actualizado {formatDate(dolar.lastUpdated)}</p>
              </article>
            ))}
          </div>

          <article className={`rounded-[2rem] border p-6 ${gap === null ? 'border-slate-800 bg-slate-900/70' : gap >= 15 ? 'border-amber-500/30 bg-amber-500/10' : 'border-emerald-500/20 bg-emerald-500/10'}`}>
            <p className="text-sm text-slate-300">Brecha entre dolar MEP y oficial</p>
            <p className="mt-3 text-4xl font-semibold text-white">{formatPercent(gap)}</p>
            <p className="mt-2 text-sm text-slate-400">MEP {formatCurrency(dolar.mep)} vs oficial {formatCurrency(dolar.oficial)}</p>
          </article>
        </section>
      ) : null}
    </div>
  );
}

export default function MercadoPage() {
  return (
    <Suspense fallback={<div className="h-32 animate-pulse rounded-[2rem] bg-slate-900/70" />}>
      <MercadoPageContent />
    </Suspense>
  );
}
