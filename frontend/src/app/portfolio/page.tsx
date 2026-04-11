'use client';

import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { usePortfolio } from '@/hooks/usePortfolio';
import { usePositions } from '@/hooks/usePositions';
import { useTransactions } from '@/hooks/useTransactions';
import { useWealthSummary } from '@/hooks/useWealthSummary';
import { apiClient } from '@/lib/axios';
import { formatCurrency, formatDate, formatPercent, normalizeLatinText, normalizeNullable } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';

const typeVariants = {
  BUY: 'success',
  SELL: 'danger',
  STAKE: 'info',
  UNSTAKE: 'warning',
  REWARD: 'warning',
  TRANSFER: 'neutral',
  FEE: 'neutral',
} as const;

export default function PortfolioPage() {
  const portfolioQuery = usePortfolio();
  const summaryQuery = useWealthSummary(portfolioQuery.data?.id);
  const positionsQuery = usePositions(portfolioQuery.data?.id);
  const [filters, setFilters] = useState({ assetSymbol: '', type: '', dateFrom: '', dateTo: '', page: 1, limit: 10 });
  const transactionsQuery = useTransactions(
    {
      assetSymbol: filters.assetSymbol || undefined,
      type: (filters.type || undefined) as never,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom).toISOString() : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo).toISOString() : undefined,
      page: filters.page,
      limit: filters.limit,
    },
    portfolioQuery.data?.id,
  );

  const deleteTransactionMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      await apiClient.delete(`/portfolio/${portfolioQuery.data?.id}/transactions/${transactionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio', 'positions'] });
      queryClient.invalidateQueries({ queryKey: ['wealth', 'summary'] });
    },
  });

  if (portfolioQuery.isLoading || summaryQuery.isLoading || positionsQuery.isLoading) {
    return <LoadingSpinner size="lg" text="Cargando portfolio..." />;
  }

  if (portfolioQuery.isError || summaryQuery.isError || positionsQuery.isError || !summaryQuery.data || !positionsQuery.data) {
    return <ErrorMessage message="No pudimos cargar tu portfolio." retry={() => { portfolioQuery.refetch(); summaryQuery.refetch(); positionsQuery.refetch(); }} />;
  }

  const summary = summaryQuery.data;
  const portfolio = portfolioQuery.data;
  const transactions = transactionsQuery.data;

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        title="Mi Portfolio"
        subtitle={`Portfolio activo: ${portfolio?.name ?? '-'}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/portfolio/nueva-transaccion" className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
              Nueva transacción
            </Link>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <StatCard label="Capital invertido" value={summary.totalInvested} prefix="$" />
        <StatCard label="P&L total" value={summary.totalPnlUsd} prefix="$" change={summary.totalPnlPct} changeType={(summary.totalPnlUsd ?? 0) >= 0 ? 'positive' : 'negative'} />
        <StatCard label="Posiciones" value={summary.positions.length} />
        <StatCard label="Transacciones totales" value={portfolio?.summary?.transactions ?? 0} />
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Posiciones actuales</h2>
            <p className="mt-2 text-sm text-slate-400">Entrá a cada activo para sumar operaciones, corregir una carga o revisar el historial específico.</p>
          </div>
          <Badge label={`${summary.positions.length} activas`} variant="info" />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-4 py-3">Activo</th>
                <th className="px-4 py-3">Mercado</th>
                <th className="px-4 py-3">Cantidad</th>
                <th className="px-4 py-3">Precio prom. compra</th>
                <th className="px-4 py-3">Precio actual</th>
                <th className="px-4 py-3">Valor actual</th>
                <th className="px-4 py-3">P&L USD</th>
                <th className="px-4 py-3">P&L %</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {summary.positions.map((position) => {
                const symbol = (position.symbol ?? position.asset?.symbol ?? '-').toUpperCase();
                return (
                  <tr key={position.assetId ?? symbol} className="border-t border-slate-800 transition hover:bg-slate-800/40">
                    <td className="px-4 py-4 font-medium text-white">{symbol}</td>
                    <td className="px-4 py-4 text-slate-300">{position.market}</td>
                    <td className="px-4 py-4 text-slate-300">{position.quantity}</td>
                    <td className="px-4 py-4 text-slate-300">{formatCurrency(position.avgCost)}</td>
                    <td className="px-4 py-4 text-slate-300">{formatCurrency(position.currentPrice)}</td>
                    <td className="px-4 py-4 text-slate-300">{formatCurrency(position.currentValue)}</td>
                    <td className={`px-4 py-4 ${(position.pnlUsd ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatCurrency(position.pnlUsd)}</td>
                    <td className={`px-4 py-4 ${(position.pnlPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatPercent(position.pnlPct)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/portfolio/${symbol}/${symbol}`} className="rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:text-white">
                          Gestionar
                        </Link>
                        <Link href={`/portfolio/nueva-transaccion?symbol=${symbol}&market=${position.market}`} className="rounded-full bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400">
                          Operar
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Historial de transacciones</h2>
            <p className="text-sm text-slate-400">Filtrá movimientos y corregí cargas desde el historial cuando haga falta.</p>
          </div>
          <input value={filters.assetSymbol} onChange={(event) => setFilters((state) => ({ ...state, assetSymbol: event.target.value, page: 1 }))} placeholder="Activo" className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500" />
          <select value={filters.type} onChange={(event) => setFilters((state) => ({ ...state, type: event.target.value, page: 1 }))} className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500">
            <option value="">Todos los tipos</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
            <option value="STAKE">STAKE</option>
            <option value="UNSTAKE">UNSTAKE</option>
            <option value="REWARD">REWARD</option>
            <option value="TRANSFER">TRANSFER</option>
            <option value="FEE">FEE</option>
          </select>
          <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((state) => ({ ...state, dateFrom: event.target.value, page: 1 }))} className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500" />
          <input type="date" value={filters.dateTo} onChange={(event) => setFilters((state) => ({ ...state, dateTo: event.target.value, page: 1 }))} className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500" />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Activo</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Cantidad</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Total USD</th>
                <th className="px-4 py-3">Notas</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(transactions?.data ?? []).map((transaction) => {
                const symbol = transaction.asset?.symbol ?? '-';
                const market = transaction.asset?.market ?? 'CRYPTO';

                return (
                  <tr key={transaction.id} className="border-t border-slate-800 transition hover:bg-slate-800/40">
                    <td className="px-4 py-4 text-slate-300">{formatDate(transaction.date)}</td>
                    <td className="px-4 py-4 font-medium text-white">{symbol}</td>
                    <td className="px-4 py-4"><Badge label={transaction.type} variant={typeVariants[transaction.type]} /></td>
                    <td className="px-4 py-4 text-slate-300">{transaction.quantity}</td>
                    <td className="px-4 py-4 text-slate-300">{formatCurrency(transaction.priceUsd)}</td>
                    <td className="px-4 py-4 text-slate-300">{formatCurrency(transaction.totalUsd)}</td>
                    <td className="px-4 py-4 text-slate-300">{normalizeLatinText(normalizeNullable(transaction.notes))}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/portfolio/nueva-transaccion?symbol=${symbol}&market=${market}&type=${transaction.type}&quantity=${transaction.quantity}&priceUsd=${transaction.priceUsd}&fee=${transaction.fee}&notes=${encodeURIComponent(transaction.notes ?? '')}`}
                          className="rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:text-white"
                        >
                          Repetir / corregir
                        </Link>
                        <button
                          type="button"
                          onClick={() => deleteTransactionMutation.mutate(transaction.id)}
                          className="rounded-full border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:border-rose-400 hover:text-rose-200"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button type="button" disabled={(transactions?.page ?? 1) <= 1} onClick={() => setFilters((state) => ({ ...state, page: Math.max(1, state.page - 1) }))} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-40">
            Página anterior
          </button>
          <p className="text-sm text-slate-400">Página {transactions?.page ?? 1}</p>
          <button type="button" disabled={(transactions?.data?.length ?? 0) < filters.limit} onClick={() => setFilters((state) => ({ ...state, page: state.page + 1 }))} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-40">
            Siguiente página
          </button>
        </div>
      </section>
    </div>
  );
}
