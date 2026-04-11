'use client';

import { useQuery } from '@tanstack/react-query';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useNotifications } from '@/hooks/useNotifications';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useWealthSummary } from '@/hooks/useWealthSummary';
import { apiClient } from '@/lib/axios';
import { formatCurrency, formatDate, formatNumber, formatPercent, formatRelativeTime } from '@/lib/format';
import { useAppStore } from '@/store/useAppStore';
import type { FearGreedData, WealthChartPoint } from '@/types/app';

function getFearGreedVariant(value: number): 'danger' | 'warning' | 'neutral' | 'info' | 'success' {
  if (value <= 20) return 'danger';
  if (value <= 40) return 'warning';
  if (value <= 60) return 'neutral';
  if (value <= 80) return 'info';
  return 'success';
}

export default function DashboardPage() {
  const portfolioQuery = usePortfolio();
  const wealthSummaryQuery = useWealthSummary(portfolioQuery.data?.id);
  const notificationsQuery = useNotifications({ limit: 3 });
  const prices = useAppStore((state) => state.prices);

  const chartQuery = useQuery({
    queryKey: ['dashboard-chart', portfolioQuery.data?.id],
    queryFn: async () => {
      const { data } = await apiClient.get<WealthChartPoint[]>(`/portfolio/${portfolioQuery.data?.id}/wealth/chart`, {
        params: { period: '1M' },
      });
      return data;
    },
    enabled: Boolean(portfolioQuery.data?.id),
    staleTime: 30000,
  });

  const fearGreedQuery = useQuery({
    queryKey: ['fear-greed'],
    queryFn: async () => {
      const { data } = await apiClient.get<FearGreedData | null>('/sentiment/fear-greed');
      return data;
    },
    staleTime: 60000,
  });

  if (portfolioQuery.isLoading || wealthSummaryQuery.isLoading) {
    return <LoadingSpinner size="lg" text="Cargando dashboard..." />;
  }

  if (portfolioQuery.isError || wealthSummaryQuery.isError || !wealthSummaryQuery.data) {
    return <ErrorMessage message="No pudimos cargar el dashboard general." retry={() => { portfolioQuery.refetch(); wealthSummaryQuery.refetch(); }} />;
  }

  const summary = wealthSummaryQuery.data;
  const topPositions = [...summary.positions]
    .sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))
    .slice(0, 5);
  const fearGreed = fearGreedQuery.data;
  const liveSymbols = ['BTC', 'ETH', 'SOL'] as const;

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard general" subtitle="Resumen rápido del patrimonio, mercado y alertas recientes conectado al backend NestJS." />

      <section className="grid grid-cols-4 gap-4">
        <StatCard label="Patrimonio total" value={summary.totalValueUsd} prefix="$" />
        <StatCard label="P&L del día" value={summary.dayChange} prefix="$" change={summary.dayChangePct} changeType={(summary.dayChange ?? 0) >= 0 ? 'positive' : 'negative'} />
        <StatCard label="Retorno total" value={summary.totalPnlPct} prefix="%" />
        <StatCard label="Activos" value={summary.positions.length} />
      </section>

      <section className="grid grid-cols-5 gap-6">
        <article className="col-span-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Evolución 30 días</h2>
              <p className="text-sm text-slate-400">Valor total vs capital invertido.</p>
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartQuery.data ?? []}>
                <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })} stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(value) => `$${formatNumber(value, 0)}`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => formatDate(label as string)} />
                <Line type="monotone" dataKey="totalValueUsd" stroke="#38bdf8" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="totalInvested" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="col-span-2 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Top posiciones</h2>
          <div className="mt-5 space-y-3">
            {topPositions.map((position) => (
              <div key={position.assetId ?? position.symbol} className="flex items-center justify-between rounded-2xl bg-slate-950/70 px-4 py-3">
                <div>
                  <p className="font-medium text-white">{position.symbol ?? position.asset?.symbol ?? '—'}</p>
                  <p className="text-sm text-slate-400">{formatCurrency(position.currentValue)}</p>
                </div>
                <Badge label={formatPercent(position.pnlPct)} variant={(position.pnlPct ?? 0) >= 0 ? 'success' : 'danger'} />
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-3 gap-6">
        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Sentimiento del mercado</h2>
          {fearGreed ? (
            <div className="mt-6">
              <div className="flex items-end justify-between">
                <p className="text-5xl font-semibold text-white">{fearGreed.value}</p>
                <Badge label={fearGreed.classification} variant={getFearGreedVariant(fearGreed.value)} />
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400" style={{ width: `${fearGreed.value}%` }} />
              </div>
              <p className="mt-4 text-sm text-slate-400">Actualizado {formatRelativeTime(fearGreed.timestamp)}</p>
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-400">No hay datos de fear & greed en este momento.</p>
          )}
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Últimas alertas</h2>
          <div className="mt-5 space-y-3">
            {(notificationsQuery.data?.data ?? []).map((notification) => (
              <div key={notification.id} className="rounded-2xl bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{notification.title}</p>
                  <Badge label={notification.type.replaceAll('_', ' ')} variant="info" />
                </div>
                <p className="mt-2 text-sm text-slate-300">{notification.message}</p>
                <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(notification.createdAt)}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Precios live</h2>
          <div className="mt-5 space-y-3">
            {liveSymbols.map((symbol) => (
              <div key={symbol} className="flex items-center justify-between rounded-2xl bg-slate-950/70 px-4 py-3">
                <div>
                  <p className="font-medium text-white">{symbol}</p>
                  <p className="text-xs text-slate-500">Cambio 24h: -</p>
                </div>
                <p className="font-medium text-cyan-300">{formatCurrency(prices.get(symbol))}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
