'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { SuggestionBot } from '@/components/suggestions/SuggestionBot';
import { SuggestionCard } from '@/components/suggestions/SuggestionCard';
import { Badge } from '@/components/ui/Badge';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { useSuggestions } from '@/hooks/useSuggestions';
import { apiClient } from '@/lib/axios';
import { formatDate, normalizeLatinText } from '@/lib/format';
import { buildMarketDetailHref } from '@/lib/market';
import type { AssetMarket, EmergingAsset, RiskLevel, Suggestion, SuggestionCategory, TimeHorizon } from '@/types/app';

type MarketFilter = 'ALL' | AssetMarket | 'CEDEARS';
type ViewMode = 'score' | 'category';
type ScoreFilter = 'ALL' | '45' | '60' | '70' | '80';
type EmergingPotentialFilter = 'ALL' | 'HIGH' | 'MEDIUM';

const PAGE_SIZE = 6;

const MARKET_OPTIONS: Array<{ value: MarketFilter; label: string }> = [
  { value: 'ALL', label: 'Todos los mercados' },
  { value: 'CRYPTO', label: 'Cripto' },
  { value: 'STOCK_AR', label: 'Acciones AR' },
  { value: 'CEDEARS', label: 'CEDEARs' },
  { value: 'BOND', label: 'Bonos' },
  { value: 'FX', label: 'Dolar / FX' },
  { value: 'STAKING', label: 'Staking' },
];

const CATEGORY_OPTIONS: Array<{ value: 'ALL' | SuggestionCategory; label: string }> = [
  { value: 'ALL', label: 'Todas las categorias' },
  { value: 'ESTABLISHED', label: 'Establecido' },
  { value: 'EMERGING', label: 'Emergente' },
  { value: 'RECOVERY', label: 'Recuperacion' },
  { value: 'LISTING_SOON', label: 'Proximo listing' },
  { value: 'MACRO_DRIVEN', label: 'Macro' },
  { value: 'TECHNICAL_SETUP', label: 'Tecnico' },
];

const RISK_OPTIONS: Array<{ value: 'ALL' | RiskLevel; label: string }> = [
  { value: 'ALL', label: 'Todo riesgo' },
  { value: 'LOW', label: 'Bajo' },
  { value: 'MEDIUM', label: 'Medio' },
  { value: 'HIGH', label: 'Alto' },
  { value: 'VERY_HIGH', label: 'Muy alto' },
];

const HORIZON_OPTIONS: Array<{ value: 'ALL' | TimeHorizon; label: string }> = [
  { value: 'ALL', label: 'Todo plazo' },
  { value: 'SHORT_TERM', label: 'Corto plazo' },
  { value: 'MEDIUM_TERM', label: 'Mediano plazo' },
  { value: 'LONG_TERM', label: 'Largo plazo' },
];

const SCORE_OPTIONS: Array<{ value: ScoreFilter; label: string }> = [
  { value: 'ALL', label: 'Todo score' },
  { value: '45', label: 'Desde 45' },
  { value: '60', label: 'Desde 60' },
  { value: '70', label: 'Desde 70' },
  { value: '80', label: 'Desde 80' },
];

function SuggestionsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-[760px] rounded-[2rem] bg-slate-900/70" />
        ))}
      </div>
    </div>
  );
}

function sectionTitle(category: SuggestionCategory): string {
  switch (category) {
    case 'ESTABLISHED':
      return 'Establecidos';
    case 'EMERGING':
      return 'Emergentes';
    case 'RECOVERY':
      return 'Recuperacion';
    case 'LISTING_SOON':
      return 'Proximos listings';
    case 'MACRO_DRIVEN':
      return 'Macro';
    case 'TECHNICAL_SETUP':
      return 'Tecnico';
    default:
      return category;
  }
}

function emergingSourceLabel(source: EmergingAsset['source']): string {
  if (source === 'COINGECKO_NEW') return 'CoinGecko';
  if (source === 'BINANCE_LISTING') return 'Binance';
  if (source === 'BYMA_LISTING') return 'BYMA';
  return 'Manual';
}

export default function SugerenciasPage() {
  const [botOpen, setBotOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<{ symbol?: string; market?: AssetMarket }>({});
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | SuggestionCategory>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | RiskLevel>('ALL');
  const [horizonFilter, setHorizonFilter] = useState<'ALL' | TimeHorizon>('ALL');
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('45');
  const [emergingPotentialFilter, setEmergingPotentialFilter] = useState<EmergingPotentialFilter>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('score');
  const [page, setPage] = useState(1);
  const sessionId = useMemo(() => 'suggestions-page', []);

  const suggestionsQuery = useSuggestions({
    market: marketFilter === 'ALL' ? undefined : marketFilter,
    category: categoryFilter === 'ALL' ? undefined : categoryFilter,
    riskLevel: riskFilter === 'ALL' ? undefined : riskFilter,
    timeHorizon: horizonFilter === 'ALL' ? undefined : horizonFilter,
    minScore: scoreFilter === 'ALL' ? undefined : Number(scoreFilter),
    limit: 60,
  });
  const emergingQuery = useQuery({
    queryKey: ['suggestions-emerging'],
    queryFn: async () => {
      const { data } = await apiClient.get<EmergingAsset[]>('/suggestions/emerging');
      return data;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const openBot = (suggestion: Suggestion) => {
    setSelectedAsset({ symbol: suggestion.symbol, market: suggestion.market });
    setBotOpen(true);
  };

  if (suggestionsQuery.isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Sugerencias activas" subtitle="Ideas accionables ordenadas por conviccion, con filtros, score y senales completas por activo." />
        <SuggestionsSkeleton />
      </div>
    );
  }

  if (suggestionsQuery.isError) {
    return <ErrorMessage message="No pudimos cargar las sugerencias activas." retry={() => suggestionsQuery.refetch()} />;
  }

  const suggestions = suggestionsQuery.data ?? [];
  const latestUpdate = suggestions[0]?.calculatedAt ?? null;
  const filtersActive =
    marketFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    riskFilter !== 'ALL' ||
    horizonFilter !== 'ALL' ||
    scoreFilter !== '45';
  const highConviction = suggestions.filter((item) => item.convictionScore >= 70).length;
  const totalPages = Math.max(1, Math.ceil(suggestions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedSuggestions = suggestions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const grouped = suggestions.reduce<Record<string, Suggestion[]>>((acc, item) => {
    const key = item.category;
    acc[key] = acc[key] ?? [];
    acc[key].push(item);
    return acc;
  }, {});
  const emergingAlerts = [...(emergingQuery.data ?? [])]
    .map((asset) => {
      const daysSinceDiscovery = Math.max(0, (Date.now() - new Date(asset.discoveredAt).getTime()) / (1000 * 60 * 60 * 24));
      const recencyScore = Math.max(0, 30 - daysSinceDiscovery);
      const marketCapScore = asset.marketCap !== null
        ? asset.marketCap >= 100000000 ? 35
          : asset.marketCap >= 25000000 ? 25
            : asset.marketCap >= 10000000 ? 15
              : 5
        : 12;
      const sourceScore = asset.source === 'BINANCE_LISTING' ? 30 : asset.source === 'COINGECKO_NEW' ? 24 : 18;
      const exchangeScore = asset.listingExchange === 'BINANCE' ? 18 : asset.listingExchange === 'BYMA' ? 12 : 8;
      const potentialScore = Math.round(Math.min(100, recencyScore + marketCapScore + sourceScore + exchangeScore));
      const recommendedPotential: EmergingPotentialFilter = potentialScore >= 75 ? 'HIGH' : potentialScore >= 55 ? 'MEDIUM' : 'ALL';

      return { ...asset, potentialScore, recommendedPotential };
    })
    .filter((asset) => emergingPotentialFilter === 'ALL' || asset.recommendedPotential === emergingPotentialFilter)
    .sort((left, right) => right.potentialScore - left.potentialScore);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sugerencias activas"
        subtitle={normalizeLatinText('Los activos pueden mezclarse entre mercados y se ordenan por nivel de convicción, con filtros completos arriba de todo.')}
        actions={latestUpdate ? <Badge label={`Actualizado ${formatDate(latestUpdate)}`} variant="info" /> : undefined}
      />

      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Panel</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Filtros de sugerencias</h2>
            <p className="mt-1 text-sm text-slate-400">{normalizeLatinText('Volvieron los filtros arriba de todo y ahora se aplican a la grilla principal ordenada por convicción.')}</p>
          </div>
          <div className="inline-flex rounded-full border border-slate-700 bg-slate-950/60 p-1">
            <button
              type="button"
              onClick={() => {
                setViewMode('score');
                setPage(1);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${viewMode === 'score' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'}`}
            >
              Ver por score
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('category');
                setPage(1);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${viewMode === 'category' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'}`}
            >
              Ver por categoria
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <select
            value={marketFilter}
            onChange={(event) => {
              setMarketFilter(event.target.value as MarketFilter);
              setPage(1);
            }}
            className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
          >
            {MARKET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value as 'ALL' | SuggestionCategory);
              setPage(1);
            }}
            className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
          >
            {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select
            value={riskFilter}
            onChange={(event) => {
              setRiskFilter(event.target.value as 'ALL' | RiskLevel);
              setPage(1);
            }}
            className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
          >
            {RISK_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select
            value={horizonFilter}
            onChange={(event) => {
              setHorizonFilter(event.target.value as 'ALL' | TimeHorizon);
              setPage(1);
            }}
            className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
          >
            {HORIZON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select
            value={scoreFilter}
            onChange={(event) => {
              setScoreFilter(event.target.value as ScoreFilter);
              setPage(1);
            }}
            className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
          >
            {SCORE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge label={`${suggestions.length} activas`} variant="info" />
          <Badge label={`${highConviction} con conviccion alta`} variant="success" />
          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setMarketFilter('ALL');
                setCategoryFilter('ALL');
                setRiskFilter('ALL');
                setHorizonFilter('ALL');
                setScoreFilter('45');
                setPage(1);
              }}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      </section>

      {!emergingQuery.isError && (emergingQuery.data?.length ?? 0) > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-amber-500/25 bg-amber-500/10 px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-white">Alertas tempranas de CoinGecko</h2>
              <p className="mt-1 text-sm text-amber-100/80">Se suman nuevamente entre los filtros y la grilla principal para destacar activos detectados recientemente, ahora con potencial recomendado.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={emergingPotentialFilter}
                onChange={(event) => setEmergingPotentialFilter(event.target.value as EmergingPotentialFilter)}
                className="rounded-2xl border border-amber-400/30 bg-slate-950/50 px-4 py-2 text-sm text-white outline-none focus:border-amber-300"
              >
                <option value="ALL">Todo potencial</option>
                <option value="HIGH">Potencial alto</option>
                <option value="MEDIUM">Potencial medio</option>
              </select>
              <Badge label={`${emergingAlerts.length} alertas`} variant="warning" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {emergingAlerts.slice(0, 6).map((asset) => (
              <Link
                key={asset.id}
                href={buildMarketDetailHref(asset.symbol, asset.market)}
                className="block rounded-[2rem] border border-amber-500/25 bg-[linear-gradient(180deg,rgba(245,158,11,0.16),rgba(120,53,15,0.12))] p-5 shadow-[0_20px_50px_rgba(120,53,15,0.18)] transition hover:-translate-y-0.5 hover:border-amber-300/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-2xl font-semibold text-white">{asset.symbol}</h3>
                      <Badge label={emergingSourceLabel(asset.source)} variant="warning" />
                    </div>
                    <p className="mt-2 text-sm text-amber-50/85">{normalizeLatinText(asset.name)}</p>
                  </div>
                  <Badge label="Alerta" variant="warning" />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge label={asset.listingExchange ?? 'Descubrimiento'} variant="neutral" />
                  <Badge label={asset.marketCap ? 'Con market cap' : 'Sin market cap'} variant="neutral" />
                  <Badge label={asset.potentialScore >= 75 ? 'Potencial alto' : asset.potentialScore >= 55 ? 'Potencial medio' : 'En observacion'} variant="warning" />
                </div>

                <div className="mt-4 rounded-[1.5rem] border border-amber-400/20 bg-slate-950/30 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-amber-200/80">Descripcion</p>
                  <p className="mt-3 text-sm leading-7 text-slate-100">
                    {asset.source === 'COINGECKO_NEW'
                      ? 'Activo detectado recientemente por CoinGecko y agregado al radar temprano para seguimiento.'
                      : asset.source === 'BINANCE_LISTING'
                        ? 'Activo detectado por anuncio de listing y marcado para seguimiento temprano dentro del panel.'
                        : 'Activo emergente detectado recientemente y sumado al monitoreo de sugerencias.'}
                  </p>
                </div>

                <div className="mt-4 text-xs text-amber-50/75">
                  Detectado {formatDate(asset.discoveredAt)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {suggestions.length === 0 ? (
        <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 px-6 py-8 text-sm text-slate-400">
          No encontramos activos para esos filtros. Proba ampliar mercado, categoria, riesgo o score minimo.
        </div>
      ) : null}

      {suggestions.length > 0 && viewMode === 'score' ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/70 px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-white">Sugerencias activas</h2>
              <p className="mt-1 text-sm text-slate-400">{normalizeLatinText('Mercados mezclados y ordenados por convicción, con todas las señales visibles en cada card.')}</p>
            </div>
            <Badge label="Ordenado por score" variant="neutral" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {paginatedSuggestions.map((suggestion) => (
              <SuggestionCard key={suggestion.id} suggestion={suggestion} onAskAurora={() => openBot(suggestion)} />
            ))}
          </div>
          <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </section>
      ) : null}

      {suggestions.length > 0 && viewMode === 'category' ? (
        <section className="space-y-8">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/70 px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-white">{sectionTitle(category as SuggestionCategory)}</h2>
                  <p className="mt-1 text-sm text-slate-400">Agrupacion visual para revisar ideas por tipo de tesis sin perder la conviccion.</p>
                </div>
                <Badge label={`${items.length} activos`} variant="neutral" />
              </div>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {items.map((suggestion) => (
                  <SuggestionCard key={suggestion.id} suggestion={suggestion} onAskAurora={() => openBot(suggestion)} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <SuggestionBot
        isOpen={botOpen}
        onClose={() => setBotOpen(false)}
        initialSymbol={selectedAsset.symbol}
        initialMarket={selectedAsset.market}
        sessionId={sessionId}
      />
    </div>
  );
}
