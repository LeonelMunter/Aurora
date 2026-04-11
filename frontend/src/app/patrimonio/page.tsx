'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useWealthSummary } from '@/hooks/useWealthSummary';
import { apiClient } from '@/lib/axios';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';
import type { DolarData, PeriodComparison, RiskMetrics, StakingMetrics, WealthChartPoint } from '@/types/app';

const periods = ['7D', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as const;
const colors: Record<string, string> = {
  CRYPTO: '#38bdf8',
  STOCK_AR: '#10b981',
  BOND: '#f59e0b',
  FX: '#fb7185',
  STAKING: '#a855f7',
};

export default function PatrimonioPage() {
  const [period, setPeriod] = useState<(typeof periods)[number]>('1M');
  const portfolioQuery = usePortfolio();
  const summaryQuery = useWealthSummary(portfolioQuery.data?.id);

  const chartQuery = useQuery({
    queryKey: ['wealth-chart', portfolioQuery.data?.id, period],
    queryFn: async () => {
      const { data } = await apiClient.get<WealthChartPoint[]>(`/portfolio/${portfolioQuery.data?.id}/wealth/chart`, {
        params: { period },
      });
      return data;
    },
    enabled: Boolean(portfolioQuery.data?.id),
    staleTime: 30000,
  });

  const comparisonQuery = useQuery({
    queryKey: ['wealth-comparison', portfolioQuery.data?.id],
    queryFn: async () => {
      const { data } = await apiClient.get<PeriodComparison[]>(`/portfolio/${portfolioQuery.data?.id}/wealth/comparison`);
      return data;
    },
    enabled: Boolean(portfolioQuery.data?.id),
    staleTime: 60000,
  });

  const riskQuery = useQuery({
    queryKey: ['wealth-risk', portfolioQuery.data?.id],
    queryFn: async () => {
      const { data } = await apiClient.get<RiskMetrics>(`/portfolio/${portfolioQuery.data?.id}/wealth/risk`);
      return data;
    },
    enabled: Boolean(portfolioQuery.data?.id),
    staleTime: 60000,
  });

  const stakingQuery = useQuery({
    queryKey: ['wealth-staking', portfolioQuery.data?.id],
    queryFn: async () => {
      const { data } = await apiClient.get<StakingMetrics>(`/portfolio/${portfolioQuery.data?.id}/wealth/staking`);
      return data;
    },
    enabled: Boolean(portfolioQuery.data?.id),
    staleTime: 60000,
  });

  const dolarQuery = useQuery({
    queryKey: ['ar-dolar', 'wealth'],
    queryFn: async () => {
      const { data } = await apiClient.get<DolarData>('/market/ar/dolar');
      return data;
    },
    staleTime: 60000,
  });

  if (portfolioQuery.isLoading || summaryQuery.isLoading || chartQuery.isLoading || dolarQuery.isLoading) {
    return <LoadingSpinner size="lg" text="Cargando panel de patrimonio..." />;
  }

  if (portfolioQuery.isError || summaryQuery.isError || chartQuery.isError || dolarQuery.isError || !summaryQuery.data) {
    return <ErrorMessage message="No pudimos cargar el panel de patrimonio." retry={() => { portfolioQuery.refetch(); summaryQuery.refetch(); chartQuery.refetch(); dolarQuery.refetch(); }} />;
  }

  const summary = summaryQuery.data;
  const dolarCripto = dolarQuery.data?.cripto ?? dolarQuery.data?.mep ?? null;
  const winners = [...summary.positions].sort((a, b) => (b.pnlPct ?? -999) - (a.pnlPct ?? -999)).slice(0, 3);
  const losers = [...summary.positions].sort((a, b) => (a.pnlPct ?? 999) - (b.pnlPct ?? 999)).slice(0, 3);

  return (
    <div className="space-y-8">
      <PageHeader title="Panel de Patrimonio" subtitle="Visión completa del patrimonio, evolución, riesgo y staking." />

      <section className="grid grid-cols-3 gap-4">
        <StatCard label="Patrimonio total" value={summary.totalValueUsd} prefix="$" />
        <StatCard label="Patrimonio total ARS" value={summary.totalValueUsd !== null && dolarCripto !== null ? formatCurrency(summary.totalValueUsd * dolarCripto).replace('$', '$ARS ') : null} />
        <StatCard label="P&L total" value={summary.totalPnlUsd} prefix="$" change={summary.totalPnlPct} changeType={(summary.totalPnlUsd ?? 0) >= 0 ? 'positive' : 'negative'} />
        <StatCard label="P&L del día" value={summary.dayChange} prefix="$" change={summary.dayChangePct} changeType={(summary.dayChange ?? 0) >= 0 ? 'positive' : 'negative'} />
        <StatCard label="Máximo histórico" value={summary.allTimeHigh} prefix="$" />
        <StatCard label="Rendimiento anualizado" value={summary.totalPnlPct} prefix="%" />
        <StatCard label="Capital invertido" value={summary.totalInvested} prefix="$" />
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Posiciones actuales</h2>
            <p className="text-sm text-slate-400">Conversión en pesos valuada al dólar cripto actual.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
            Dólar cripto: <span className="font-semibold text-white">{dolarCripto === null ? '-' : formatCurrency(dolarCripto).replace('$', '$ARS ')}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-4 py-3">Activo</th>
                <th className="px-4 py-3">Mercado</th>
                <th className="px-4 py-3">Cantidad</th>
                <th className="px-4 py-3">Valor USD</th>
                <th className="px-4 py-3">Valor ARS</th>
                <th className="px-4 py-3">P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {summary.positions.map((position) => {
                const currentValueArs = position.currentValue !== null && dolarCripto !== null ? position.currentValue * dolarCripto : null;
                return (
                  <tr key={position.assetId ?? position.symbol} className="border-t border-slate-800 transition hover:bg-slate-800/40">
                    <td className="px-4 py-4 font-medium text-white">{position.symbol}</td>
                    <td className="px-4 py-4 text-slate-300">{position.market}</td>
                    <td className="px-4 py-4 text-slate-300">{position.quantity}</td>
                    <td className="px-4 py-4 text-slate-300">{formatCurrency(position.currentValue)}</td>
                    <td className="px-4 py-4 text-slate-300">{currentValueArs === null ? '-' : formatCurrency(currentValueArs).replace('$', '$ARS ')}</td>
                    <td className={`px-4 py-4 ${(position.pnlUsd ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatCurrency(position.pnlUsd)} ({formatPercent(position.pnlPct)})</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Evolución patrimonial</h2>
            <p className="text-sm text-slate-400">Serie histórica del valor total y capital invertido.</p>
          </div>
          <div className="flex gap-2">
            {periods.map((item) => (
              <button key={item} type="button" onClick={() => setPeriod(item)} className={`rounded-full px-3 py-2 text-xs font-semibold ${period === item ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartQuery.data ?? []}>
              <defs>
                <linearGradient id="wealthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#94a3b8" tickFormatter={(value) => new Date(value).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })} />
              <YAxis stroke="#94a3b8" tickFormatter={(value) => `$${value}`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => formatDate(label as string)} />
              <Area type="monotone" dataKey="totalValueUsd" stroke="#38bdf8" fill="url(#wealthFill)" strokeWidth={3} />
              <Area type="monotone" dataKey="totalInvested" stroke="#94a3b8" fill="transparent" strokeDasharray="6 6" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-6">
        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Distribución por mercado</h2>
          <div className="mt-6 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={summary.byMarket} dataKey="valueUsd" nameKey="market" innerRadius={70} outerRadius={100} paddingAngle={3}>
                  {summary.byMarket.map((item) => (
                    <Cell key={item.market} fill={colors[item.market] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
            {summary.byMarket.map((item) => (
              <div key={item.market} className="rounded-2xl bg-slate-950/70 px-4 py-3">
                <p className="font-medium text-white">{item.market}</p>
                <p>{formatPercent(item.pct)}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Comparación de períodos</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Valor inicio</th>
                  <th className="px-4 py-3">Valor actual</th>
                  <th className="px-4 py-3">Cambio USD</th>
                  <th className="px-4 py-3">Cambio %</th>
                </tr>
              </thead>
              <tbody>
                {(comparisonQuery.data ?? []).map((item) => (
                  <tr key={item.period} className={`border-t border-slate-800 ${(item.changeUsd ?? 0) >= 0 ? 'bg-emerald-500/5' : 'bg-rose-500/5'}`}>
                    <td className="px-4 py-4 text-white">{item.period}</td>
                    <td className="px-4 py-4 text-slate-300">{formatCurrency(item.valueStart)}</td>
                    <td className="px-4 py-4 text-slate-300">{formatCurrency(item.valueEnd)}</td>
                    <td className={`px-4 py-4 ${(item.changeUsd ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatCurrency(item.changeUsd)}</td>
                    <td className={`px-4 py-4 ${(item.changePct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatPercent(item.changePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-3 gap-6">
        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Métricas de riesgo</h2>
          {riskQuery.data ? (
            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
                  <span>Diversificación</span>
                  <span>{formatPercent(riskQuery.data.diversificationScore)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${riskQuery.data.diversificationScore}%` }} />
                </div>
              </div>
              <p className="text-sm text-slate-300">Mayor concentración: <span className="font-medium text-white">{riskQuery.data.maxConcentrationAsset || '-'}</span> ({formatPercent(riskQuery.data.maxConcentration)})</p>
              <p className="text-sm text-slate-300">Activos: {riskQuery.data.assetsCount} en {riskQuery.data.marketsCount} mercados</p>
              {riskQuery.data.maxConcentration > 40 ? <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Atención: la concentración supera el 40%.</p> : null}
            </div>
          ) : null}
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Staking metrics</h2>
          {stakingQuery.data ? (
            stakingQuery.data.rewardsByAsset.length > 0 ? (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-slate-300">Rewards acumulados: <span className="font-medium text-white">{formatCurrency(stakingQuery.data.totalRewardsUsd)}</span></p>
                <p className="text-sm text-slate-300">Proyección mensual: <span className="font-medium text-white">{formatCurrency(stakingQuery.data.projectedMonthly)}</span> / mes</p>
                <p className="text-sm text-slate-300">Proyección anual: <span className="font-medium text-white">{formatCurrency(stakingQuery.data.projectedAnnual)}</span> / año</p>
                {stakingQuery.data.rewardsByAsset.map((item) => (
                  <div key={item.symbol} className="rounded-2xl bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                    <p className="font-medium text-white">{item.symbol}</p>
                    <p>{item.quantity} rewards - {formatCurrency(item.estimatedUsd)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-400">No tenés posiciones de staking registradas.</p>
            )
          ) : null}
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Top performers</h2>
          <div className="mt-5 grid gap-4">
            <div>
              <p className="mb-3 text-sm font-medium text-emerald-300">Ganadores</p>
              <div className="space-y-2">
                {winners.map((item) => <div key={item.assetId ?? item.symbol} className="flex items-center justify-between rounded-2xl bg-slate-950/70 px-4 py-3"><span className="text-white">{item.symbol}</span><span className="text-emerald-300">{formatPercent(item.pnlPct)}</span></div>)}
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-medium text-rose-300">Perdedores</p>
              <div className="space-y-2">
                {losers.map((item) => <div key={item.assetId ?? item.symbol} className="flex items-center justify-between rounded-2xl bg-slate-950/70 px-4 py-3"><span className="text-white">{item.symbol}</span><span className="text-rose-300">{formatPercent(item.pnlPct)}</span></div>)}
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}