'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { CandlestickChart } from '@/components/charts/CandlestickChart';
import { IndicatorPanel } from '@/components/market/IndicatorPanel';
import { RecommendationPanel } from '@/components/market/RecommendationPanel';
import { Badge } from '@/components/ui/Badge';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { apiClient } from '@/lib/axios';
import { formatCurrency, formatPercent, formatRelativeTime } from '@/lib/format';
import type { ARStockPrice, AssetMarket, DolarData, MacroData, PriceSnapshot, StrategyRecommendation, TechnicalAnalysis } from '@/types/app';

const periods = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
] as const;

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-20 rounded-3xl bg-slate-900/70" />
      <div className="h-56 rounded-[2rem] bg-slate-900/70" />
      <div className="h-[520px] rounded-[2rem] bg-slate-900/70" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-[300px] rounded-[2rem] bg-slate-900/70" />
        <div className="h-[300px] rounded-[2rem] bg-slate-900/70" />
      </div>
    </div>
  );
}

function VariationStat({ label, value }: { label: string; value: number | null | undefined }) {
  const positive = (value ?? 0) >= 0;

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${value === null || value === undefined ? 'text-slate-300' : positive ? 'text-emerald-300' : 'text-rose-300'}`}>
        {value === null || value === undefined ? 'Sin datos' : formatPercent(value)}
      </p>
    </div>
  );
}

function MacroCard({ label, value, suffix = '' }: { label: string; value: number | null | undefined; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">
        {value === null || value === undefined ? 'Sin datos' : `${label.toLowerCase().includes('inflacion') ? formatPercent(value) : formatCurrency(value)}${suffix}`}
      </p>
    </div>
  );
}

export default function MercadoArAssetPage() {
  const params = useParams<{ symbol?: string }>();
  const symbol = params?.symbol?.trim()?.toUpperCase() ?? '';
  const market: AssetMarket = 'STOCK_AR';
  const [selectedPeriod, setSelectedPeriod] = useState<(typeof periods)[number]>(periods[3]);

  const analysisQuery = useQuery({
    queryKey: ['analysis-ar', symbol, market],
    queryFn: async () => {
      const { data } = await apiClient.get<TechnicalAnalysis>(`/analysis/${symbol}`, { params: { market, interval: '1d' } });
      return data;
    },
    enabled: Boolean(symbol),
    staleTime: 30000,
    retry: false,
  });

  const recommendationQuery = useQuery({
    queryKey: ['recommendation-ar', symbol, market],
    queryFn: async () => {
      const { data } = await apiClient.get<StrategyRecommendation>(`/analysis/${symbol}/full-recommendation`, { params: { market } });
      return data;
    },
    enabled: Boolean(symbol),
    staleTime: 30000,
    retry: false,
  });

  const priceQuery = useQuery({
    queryKey: ['market-price-ar', symbol, market],
    queryFn: async () => {
      const { data } = await apiClient.get<PriceSnapshot>(`/market/prices/${symbol}`, { params: { market } });
      return data;
    },
    enabled: Boolean(symbol),
    staleTime: 30000,
  });

  const arStockQuery = useQuery({
    queryKey: ['ar-stock-detail', symbol],
    queryFn: async () => {
      const { data } = await apiClient.get<ARStockPrice>(`/market/ar/stocks/${symbol}`);
      return data;
    },
    enabled: Boolean(symbol),
    staleTime: 30000,
    retry: 2,
  });

  const macroQuery = useQuery({
    queryKey: ['ar-macro-detail'],
    queryFn: async () => {
      const [macro, dolar] = await Promise.all([
        apiClient.get<MacroData>('/market/ar/macro'),
        apiClient.get<DolarData>('/market/ar/dolar'),
      ]);
      return { macro: macro.data, dolar: dolar.data };
    },
    staleTime: 60000,
  });

  if (!symbol) {
    return <ErrorMessage message="Simbolo invalido. Volve al panel de acciones argentinas y elegi un activo valido." />;
  }

  const snapshot = priceQuery.data ?? arStockQuery.data ?? null;
  if ((priceQuery.isLoading || arStockQuery.isLoading || macroQuery.isLoading) && !snapshot) {
    return <DetailSkeleton />;
  }

  if (!snapshot) {
    return (
      <ErrorMessage
        message={`No pudimos cargar el precio actual de ${symbol}. Probá nuevamente en unos minutos.`}
        retry={() => {
          priceQuery.refetch();
          arStockQuery.refetch();
          analysisQuery.refetch();
          recommendationQuery.refetch();
          macroQuery.refetch();
        }}
      />
    );
  }

  const asset = arStockQuery.data;
  const macro = macroQuery.data?.macro;
  const dolar = macroQuery.data?.dolar;
  const name = asset?.name ?? symbol;
  const priceArs = asset?.priceArs ?? snapshot.priceArs ?? null;
  const priceUsd = asset?.priceUsd ?? snapshot.priceUsd ?? null;
  const lastUpdated = asset?.lastUpdated ?? snapshot.lastUpdated ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${symbol} - ${name}`}
        subtitle="Detalle de activo argentino con precio actual, historial, analisis tecnico y contexto macro local."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Badge label="BYMA -20min" variant="warning" />
            <Link href={`/portfolio/nueva-transaccion?symbol=${encodeURIComponent(symbol)}&market=${market}`} className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950">
              Agregar al portfolio
            </Link>
            <Link href={`/alertas?symbol=${encodeURIComponent(symbol)}`} className="rounded-full border border-slate-700 px-5 py-3 text-sm text-slate-300">
              Crear alerta
            </Link>
          </div>
        }
      />

      <section className="rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.12),_transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.4)]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-5xl font-semibold text-white">{symbol}</h2>
              <Badge label={asset?.source ?? 'BYMA'} variant="info" />
            </div>
            <p className="mt-2 text-sm text-slate-400">{name}</p>
            <div className="mt-5 flex flex-wrap gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Precio ARS</p>
                <p className="mt-2 text-3xl font-semibold text-white">{priceArs === null ? 'Sin datos' : formatCurrency(priceArs).replace('$', '$ARS ')}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Precio USD</p>
                <p className="mt-2 text-3xl font-semibold text-white">{priceUsd === null ? 'Sin datos' : formatCurrency(priceUsd)}</p>
              </div>
            </div>
            <p className={`mt-4 text-sm font-medium ${(snapshot.change24h ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {snapshot.change24h === null ? 'Sin datos de variacion diaria' : `${formatPercent(snapshot.change24h)} en 24h`}
            </p>
            <p className="mt-2 text-sm text-slate-400">Actualizado {lastUpdated ? formatRelativeTime(lastUpdated) : 'sin referencia horaria'}</p>
          </div>

          <div className="grid min-w-[320px] gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <VariationStat label="24h" value={snapshot.change24h} />
            <VariationStat label="30d" value={asset?.change30d ?? analysisQuery.data?.trend.days30} />
            <VariationStat label="6m" value={asset?.change6m} />
            <VariationStat label="1y" value={asset?.change1y} />
          </div>
        </div>
      </section>

      <section className="space-y-5 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">Grafico historico</h3>
            <p className="mt-1 text-sm text-slate-400">Velas diarias para seguir la estructura del activo sin cambiar de intervalo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {periods.map((period) => (
              <button
                key={period.label}
                type="button"
                onClick={() => setSelectedPeriod(period)}
                className={`rounded-full border px-4 py-2 text-sm ${selectedPeriod.label === period.label ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300' : 'border-slate-700 text-slate-300'}`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        <CandlestickChart
          symbol={symbol}
          market={market}
          interval="1d"
          days={selectedPeriod.days}
          height={420}
          loadingMessage="Cargando historial de precios... Esto puede tardar unos segundos la primera vez."
          emptyMessage="Todavia no encontramos suficiente historial para armar el grafico. Se va a completar automaticamente cuando Yahoo Finance responda o se acumulen velas en la base."
        />
      </section>

      <section className="space-y-5 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div>
          <h3 className="text-xl font-semibold text-white">Analisis tecnico</h3>
          <p className="mt-1 text-sm text-slate-400">El analisis tecnico mejora a medida que se acumulan mas datos historicos.</p>
        </div>

        {analysisQuery.isSuccess ? (
          <IndicatorPanel analysis={analysisQuery.data} />
        ) : (
          <div className="rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
            Todavia no hay suficientes velas para calcular todos los indicadores del activo. El sistema va a completar el analisis automaticamente cuando junte mas historial.
          </div>
        )}
      </section>

      <section className="space-y-5 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div>
          <h3 className="text-xl font-semibold text-white">Recomendacion de estrategia</h3>
          <p className="mt-1 text-sm text-slate-400">Lectura operativa combinada con el contexto del activo argentino.</p>
        </div>

        {recommendationQuery.isSuccess ? (
          <RecommendationPanel recommendation={recommendationQuery.data} />
        ) : (
          <div className="rounded-[1.5rem] border border-cyan-500/20 bg-cyan-500/10 p-5 text-sm text-cyan-100">
            Analisis completo no disponible aun. Se generara automaticamente a medida que se acumulen datos historicos del activo.
          </div>
        )}
      </section>

      <section className="space-y-5 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div>
          <h3 className="text-xl font-semibold text-white">Contexto macro AR</h3>
          <p className="mt-1 text-sm text-slate-400">Variables locales que afectan valuacion, costo de cobertura y riesgo argentino.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MacroCard label="TC oficial" value={macro?.tcOficial ?? dolar?.oficial} />
          <MacroCard label="Dolar MEP" value={dolar?.mep} />
          <MacroCard label="Inflacion mensual" value={macro?.inflacionMensual} />
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">Simulador rapido</h3>
            <p className="mt-1 text-sm text-slate-400">Probalo en el simulador con el simbolo y el mercado ya cargados.</p>
          </div>
          <Link href={`/simulador?symbol=${encodeURIComponent(symbol)}&market=${market}`} className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950">
            Simular este activo
          </Link>
        </div>
      </section>
    </div>
  );
}
