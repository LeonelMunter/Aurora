'use client';

import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { CandlestickChart } from '@/components/charts/CandlestickChart';
import { IndicatorPanel } from '@/components/market/IndicatorPanel';
import { RecommendationPanel } from '@/components/market/RecommendationPanel';
import { SentimentBadge } from '@/components/market/SentimentBadge';
import { Badge } from '@/components/ui/Badge';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { apiClient } from '@/lib/axios';
import { formatCurrency, formatPercent, formatRelativeTime, normalizeLatinText } from '@/lib/format';
import { buildMarketDetailHref } from '@/lib/market';
import { useAppStore } from '@/store/useAppStore';
import type { AssetMarket, NewsResponse, PriceSnapshot, SentimentResult, StrategyRecommendation, Suggestion, TechnicalAnalysis } from '@/types/app';

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-20 rounded-3xl bg-slate-900/70" />
      <div className="h-48 rounded-[2rem] bg-slate-900/70" />
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="h-[620px] rounded-[2rem] bg-slate-900/70 xl:col-span-3" />
        <div className="h-[620px] rounded-[2rem] bg-slate-900/70 xl:col-span-2" />
      </div>
    </div>
  );
}

function marketLabel(market: AssetMarket) {
  if (market === 'CRYPTO') return 'Cripto';
  if (market === 'STOCK_AR') return 'Acciones AR';
  if (market === 'BOND') return 'Bonos';
  if (market === 'FX') return 'Dolar';
  return market;
}

function isRiskLine(text: string): boolean {
  return /(riesgo|correccion|debil|sobrecompra|volatilidad|devaluacion|baja|soberano|stop)/i.test(text);
}

function resolveQueryErrorStatus(error: unknown): number | null {
  if (axios.isAxiosError(error)) {
    return error.response?.status ?? null;
  }
  return null;
}

export default function MercadoAssetPage() {
  const router = useRouter();
  const params = useParams<{ symbol?: string }>();
  const searchParams = useSearchParams();
  const symbol = params?.symbol?.trim()?.toUpperCase() ?? '';
  const interval = searchParams.get('interval') || '1d';
  const market = (searchParams.get('market')?.toUpperCase() as AssetMarket | null) ?? 'CRYPTO';
  const livePrice = useAppStore((state) => (symbol ? state.prices.get(symbol) : undefined));

  useEffect(() => {
    if (symbol && market === 'STOCK_AR') {
      router.replace(`/mercado-ar/${encodeURIComponent(symbol)}`);
    }
  }, [market, router, symbol]);

  const analysisQuery = useQuery({
    queryKey: ['analysis', symbol, market],
    queryFn: async () => {
      const { data } = await apiClient.get<TechnicalAnalysis>(`/analysis/${symbol}`, { params: { market } });
      return data;
    },
    enabled: Boolean(symbol),
    staleTime: 30000,
    retry: false,
  });

  const recommendationQuery = useQuery({
    queryKey: ['full-recommendation', symbol, market],
    queryFn: async () => {
      const { data } = await apiClient.get<StrategyRecommendation>(`/analysis/${symbol}/full-recommendation`, { params: { market } });
      return data;
    },
    enabled: Boolean(symbol),
    staleTime: 30000,
    retry: false,
  });

  const sentimentQuery = useQuery({
    queryKey: ['sentiment-score', symbol, market],
    queryFn: async () => {
      const { data } = await apiClient.get<SentimentResult>(`/sentiment/score/${symbol}`, { params: { market } });
      return data;
    },
    enabled: Boolean(symbol),
    staleTime: 30000,
    retry: false,
  });

  const newsQuery = useQuery({
    queryKey: ['sentiment-news', symbol, market],
    queryFn: async () => {
      const { data } = await apiClient.get<NewsResponse>('/sentiment/news', { params: { symbol, market, limit: 4 } });
      return data;
    },
    enabled: Boolean(symbol),
    staleTime: 60000,
    retry: false,
  });

  const priceQuery = useQuery({
    queryKey: ['market-price', symbol, market],
    queryFn: async () => {
      const { data } = await apiClient.get<PriceSnapshot>(`/market/prices/${symbol}`, { params: { market } });
      return data;
    },
    enabled: Boolean(symbol),
    staleTime: 30000,
    retry: false,
  });

  const suggestionQuery = useQuery({
    queryKey: ['suggestion-detail', symbol, market],
    queryFn: async () => {
      const { data } = await apiClient.get<Suggestion | null>(`/suggestions/${symbol}`, { params: { market } });
      return data;
    },
    enabled: Boolean(symbol),
    staleTime: 60000,
    retry: false,
  });

  if (!symbol || symbol.length < 2) {
    return (
      <section className="space-y-6 rounded-[2rem] border border-amber-500/25 bg-amber-500/10 p-8">
        <PageHeader title="Simbolo invalido" subtitle="La URL del activo no es valida." />
        <p className="text-sm text-amber-100">Revisa la direccion e intenta nuevamente desde el mercado.</p>
        <div>
          <Link href="/mercado" className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950">Volver al mercado</Link>
        </div>
      </section>
    );
  }

  if (market === 'STOCK_AR') {
    return <DetailSkeleton />;
  }

  if (analysisQuery.isLoading || recommendationQuery.isLoading || sentimentQuery.isLoading || newsQuery.isLoading || priceQuery.isLoading || suggestionQuery.isLoading) {
    return <DetailSkeleton />;
  }

  const coreStatuses = [analysisQuery.error, recommendationQuery.error, priceQuery.error]
    .map(resolveQueryErrorStatus)
    .filter((status): status is number => status !== null);
  const suggestionStatus = resolveQueryErrorStatus(suggestionQuery.error);
  const allCoreMissing = !analysisQuery.data && !recommendationQuery.data && !priceQuery.data && !suggestionQuery.data;

  if (coreStatuses.includes(404) && allCoreMissing && suggestionStatus === 404) {
    return (
      <section className="space-y-6 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-8">
        <PageHeader title={symbol} subtitle="No encontramos datos para este activo." />
        <div className="rounded-[1.5rem] border border-amber-500/25 bg-amber-500/10 p-5 text-slate-100">
          <p className="text-lg font-semibold">{`No encontramos datos para '${symbol}'.`}</p>
          <p className="mt-2 text-sm text-slate-300">Verifica que el simbolo sea correcto.</p>
        </div>
        <div>
          <Link href="/mercado" className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950">Volver al mercado</Link>
        </div>
      </section>
    );
  }

  if (coreStatuses.includes(400)) {
    return (
      <section className="space-y-6 rounded-[2rem] border border-amber-500/25 bg-amber-500/10 p-8">
        <PageHeader title={symbol} subtitle="Simbolo invalido." />
        <p className="text-sm text-amber-100">Revisa la URL e intenta nuevamente.</p>
        <div>
          <Link href="/mercado" className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950">Volver al mercado</Link>
        </div>
      </section>
    );
  }

  if ((analysisQuery.isError || recommendationQuery.isError || priceQuery.isError) && allCoreMissing) {
    return (
      <ErrorMessage
        message={`No pudimos cargar el detalle de ${symbol}.`}
        retry={() => {
          analysisQuery.refetch();
          recommendationQuery.refetch();
          sentimentQuery.refetch();
          newsQuery.refetch();
          priceQuery.refetch();
        }}
      />
    );
  }

  const analysis = analysisQuery.data;
  const recommendation = recommendationQuery.data;
  const sentiment = sentimentQuery.data ?? null;
  const snapshot = priceQuery.data ?? null;
  const suggestion = suggestionQuery.data ?? null;

  if (!analysis && !recommendation && !snapshot && !suggestion) {
    return (
      <ErrorMessage
        message={`No pudimos completar el detalle de ${symbol}.`}
        retry={() => {
          analysisQuery.refetch();
          recommendationQuery.refetch();
          sentimentQuery.refetch();
          newsQuery.refetch();
          priceQuery.refetch();
        }}
      />
    );
  }

  const news = newsQuery.data?.data ?? [];
  const currentPrice = livePrice
    ?? snapshot?.priceUsd
    ?? snapshot?.priceArs
    ?? analysis?.lastPrice
    ?? recommendation?.entryPrice
    ?? suggestion?.priceAtAnalysis
    ?? null;
  const narrative = normalizeLatinText(
    recommendation?.reasoning?.join(' ')
    ?? suggestion?.narrative
    ?? 'Todavia no hay suficiente informacion para generar una lectura operativa completa de este activo.',
  );
  const goodReasons = recommendation?.reasoning.filter((line) => !isRiskLine(line)).slice(0, 3) ?? suggestion?.catalysts ?? [];
  const riskReasons = recommendation?.reasoning.filter((line) => isRiskLine(line)).slice(0, 3) ?? suggestion?.risks ?? [];
  const scoreLabel = recommendation?.topStrategy.score ?? suggestion?.convictionScore ?? null;
  const confidenceLabel = recommendation?.topStrategy.confidence ?? 'Pendiente';
  const strategyLabel = recommendation?.topStrategy.strategy ?? suggestion?.category ?? 'Seguimiento';
  const sentimentLabel = sentiment ? <SentimentBadge score={sentiment.score} signal={sentiment.signal} size="sm" /> : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={symbol}
        subtitle={`Detalle operativo de ${marketLabel(market)}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/mercado" className="rounded-full border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700">Volver</Link>
            <Link href={`/portfolio/nueva-transaccion?symbol=${encodeURIComponent(symbol)}&market=${market}`} className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950">Agregar al portafolio</Link>
          </div>
        }
      />

      <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.4)]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{marketLabel(market)}</span>
              <Badge label={String(strategyLabel)} variant="info" />
              {sentimentLabel}
            </div>
            <div>
              <p className="text-5xl font-semibold text-white">{formatCurrency(currentPrice)}</p>
              <p className={`mt-3 text-sm font-medium ${((snapshot?.change24h ?? 0) >= 0) ? 'text-emerald-300' : 'text-rose-300'}`}>{formatPercent(snapshot?.change24h)} en 24h</p>
              <p className="mt-2 text-sm text-slate-400">Actualizado {formatRelativeTime(snapshot?.lastUpdated ?? recommendation?.generatedAt ?? suggestion?.calculatedAt ?? null)}</p>
            </div>
          </div>

          <div className="grid min-w-[280px] gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Score</p>
              <p className="mt-2 text-2xl font-semibold text-white">{scoreLabel === null ? 'Sin datos' : `${scoreLabel}/100`}</p>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Confianza</p>
              <p className="mt-2 text-2xl font-semibold text-white">{confidenceLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Entrada</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(recommendation?.entryPrice ?? suggestion?.priceAtAnalysis ?? null)}</p>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Target / Stop</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(recommendation?.targetPrice ?? suggestion?.targetPrice ?? null)} / {formatCurrency(recommendation?.stopLoss ?? suggestion?.stopLoss ?? null)}</p>
            </div>
          </div>
        </div>

        {!analysis || !recommendation ? (
          <div className="mt-6 rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            Este activo todavia no tiene cobertura completa de analisis. Mostramos la mejor informacion disponible mientras se acumulan precios e historial.
          </div>
        ) : null}

        <div className="mt-6 rounded-[1.5rem] border border-slate-800/80 bg-slate-950/30 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Lectura operativa</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">{narrative}</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/8 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Catalizadores</p>
            <div className="mt-3 space-y-2 text-sm text-emerald-100">
              {(goodReasons.length > 0 ? goodReasons : ['Sin catalizadores destacados por ahora.']).map((item) => (
                <div key={item} className="flex gap-2"><span className="font-semibold text-emerald-300">OK</span><span>{normalizeLatinText(item)}</span></div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-rose-500/20 bg-rose-500/8 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-rose-300">Riesgos</p>
            <div className="mt-3 space-y-2 text-sm text-rose-100">
              {(riskReasons.length > 0 ? riskReasons : ['Sin riesgos explicitos en esta lectura inicial.']).map((item) => (
                <div key={item} className="flex gap-2"><span className="font-semibold text-rose-300">!</span><span>{normalizeLatinText(item)}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <div className="flex flex-wrap gap-2">
            {(['1h', '4h', '1d', '1w'] as const).map((selectedInterval) => (
              <Link key={selectedInterval} href={buildMarketDetailHref(symbol, market, { interval: selectedInterval })} className={`rounded-full border px-4 py-2 text-sm ${interval === selectedInterval ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300' : 'border-slate-700 text-slate-300'}`}>
                {selectedInterval}
              </Link>
            ))}
          </div>
          <CandlestickChart symbol={symbol} market={market} interval={interval} height={420} />
          {analysis ? <IndicatorPanel analysis={analysis} /> : (
            <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
              Todavia no hay suficientes velas historicas para calcular indicadores tecnicos completos de este activo.
            </div>
          )}
        </div>

        <div className="space-y-6 xl:col-span-2">
          {recommendation ? <RecommendationPanel recommendation={recommendation} /> : (
            <div className="rounded-[2rem] border border-cyan-500/15 bg-cyan-500/5 p-5 text-sm text-cyan-100">
              La recomendacion completa todavia no esta disponible. Mientras tanto, podes revisar la sugerencia base y el precio actual del activo.
            </div>
          )}

          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Sentimiento y noticias</h3>
              {sentiment ? <SentimentBadge score={sentiment.score} signal={sentiment.signal} size="md" /> : <Badge label="Sin sentimiento" variant="neutral" />}
            </div>
            <div className="mt-4 space-y-3">
              {news.map((item) => (
                <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block rounded-2xl bg-slate-950/60 p-4 transition hover:bg-slate-950/80">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{item.title}</p>
                    <Badge label={item.source} variant="neutral" />
                  </div>
                  {item.aiSummary ? <p className="mt-2 text-sm text-slate-300">{normalizeLatinText(item.aiSummary)}</p> : null}
                  <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(item.publishedAt)}</p>
                </a>
              ))}
              {news.length === 0 ? <p className="text-sm text-slate-400">Todavia no hay noticias recientes para este activo.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
