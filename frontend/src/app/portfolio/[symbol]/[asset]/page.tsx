'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { CandlestickChart } from '@/components/charts/CandlestickChart';
import { RecommendationPanel } from '@/components/market/RecommendationPanel';
import { SentimentBadge } from '@/components/market/SentimentBadge';
import { Badge } from '@/components/ui/Badge';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useTransactions } from '@/hooks/useTransactions';
import { useWealthSummary } from '@/hooks/useWealthSummary';
import { apiClient } from '@/lib/axios';
import { formatCurrency, formatDate, formatPercent, normalizeNullable } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/store/useAppStore';
import type { SentimentResult, StrategyRecommendation } from '@/types/app';

const typeVariants = {
  BUY: 'success',
  SELL: 'danger',
  STAKE: 'info',
  UNSTAKE: 'warning',
  REWARD: 'warning',
  TRANSFER: 'neutral',
  FEE: 'neutral',
} as const;

export default function PortfolioAssetPage() {
  const params = useParams<{ asset: string }>();
  const symbol = params.asset.toUpperCase();
  const livePrice = useAppStore((state) => state.prices.get(symbol));
  const portfolioQuery = usePortfolio();
  const summaryQuery = useWealthSummary(portfolioQuery.data?.id);
  const transactionsQuery = useTransactions({ assetSymbol: symbol, page: 1, limit: 20 }, portfolioQuery.data?.id);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickType, setQuickType] = useState<'BUY' | 'SELL'>('BUY');
  const [quickQuantity, setQuickQuantity] = useState(0);
  const [quickPrice, setQuickPrice] = useState(0);
  const [quickNotes, setQuickNotes] = useState('');

  const recommendationQuery = useQuery({
    queryKey: ['portfolio-asset-recommendation', symbol],
    queryFn: async () => {
      const { data } = await apiClient.get<StrategyRecommendation>(`/analysis/${symbol}/full-recommendation`);
      return data;
    },
    staleTime: 30000,
  });

  const sentimentQuery = useQuery({
    queryKey: ['portfolio-asset-sentiment', symbol],
    queryFn: async () => {
      const { data } = await apiClient.get<SentimentResult>(`/sentiment/score/${symbol}`);
      return data;
    },
    staleTime: 30000,
  });

  const createTransactionMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/portfolio/${portfolioQuery.data?.id}/transactions`, {
        type: quickType,
        assetSymbol: symbol,
        assetMarket: position?.market ?? 'CRYPTO',
        quantity: quickQuantity,
        priceUsd: quickPrice,
        fee: 0,
        date: new Date().toISOString(),
        notes: quickNotes || undefined,
      });
      return data;
    },
    onSuccess: () => {
      setQuickOpen(false);
      setQuickQuantity(0);
      setQuickPrice(0);
      setQuickNotes('');
      queryClient.invalidateQueries({ queryKey: ['portfolio', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio', 'positions'] });
      queryClient.invalidateQueries({ queryKey: ['wealth', 'summary'] });
    },
  });

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

  if (portfolioQuery.isLoading || summaryQuery.isLoading || transactionsQuery.isLoading || recommendationQuery.isLoading || sentimentQuery.isLoading) {
    return <div className="space-y-6 animate-pulse"><div className="h-20 rounded-3xl bg-slate-900/70" /><div className="grid grid-cols-5 gap-6"><div className="col-span-3 h-[620px] rounded-[2rem] bg-slate-900/70" /><div className="col-span-2 h-[620px] rounded-[2rem] bg-slate-900/70" /></div></div>;
  }

  if (portfolioQuery.isError || summaryQuery.isError || transactionsQuery.isError || recommendationQuery.isError || sentimentQuery.isError || !summaryQuery.data || !recommendationQuery.data || !sentimentQuery.data) {
    return <ErrorMessage message="No pudimos cargar el detalle del activo en portfolio." retry={() => { portfolioQuery.refetch(); summaryQuery.refetch(); transactionsQuery.refetch(); recommendationQuery.refetch(); sentimentQuery.refetch(); }} />;
  }

  const position = summaryQuery.data.positions.find((item) => (item.symbol ?? item.asset?.symbol ?? '').toUpperCase() === symbol);
  const firstPurchase = (transactionsQuery.data?.data ?? []).slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]?.date;

  if (!position) {
    return <ErrorMessage message={`No encontramos una posición activa para ${symbol} en tu portfolio.`} />;
  }

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        title={symbol}
        subtitle="Detalle completo del activo en portfolio"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/portfolio" className="rounded-full border border-slate-700 px-5 py-3 text-sm text-slate-300">Volver</Link>
            <Link href={`/portfolio/nueva-transaccion?symbol=${symbol}&market=${position.market}`} className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950">Comprar más</Link>
            <Link href={`/portfolio/nueva-transaccion?symbol=${symbol}&market=${position.market}&type=SELL`} className="rounded-full border border-slate-700 px-5 py-3 text-sm text-slate-300">Vender</Link>
            <Link href={`/alertas?symbol=${symbol}`} className="rounded-full border border-slate-700 px-5 py-3 text-sm text-slate-300">Crear alerta</Link>
          </div>
        }
      />

      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-sm text-slate-400">Precio actual live</p>
            <p className="mt-2 text-4xl font-semibold text-white">{formatCurrency(livePrice ?? position.currentPrice)}</p>
          </div>
          <div>
            <p className={`text-lg font-semibold ${(position.pnlUsd ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatCurrency(position.pnlUsd)}</p>
            <p className={`mt-1 text-sm ${(position.pnlPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatPercent(position.pnlPct)}</p>
          </div>
          <div className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
            {transactionsQuery.data?.total ?? 0} movimientos registrados
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-5">
        <div className="2xl:col-span-3 space-y-6">
          <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-white">Ficha del activo</h2>
              <button type="button" onClick={() => setQuickOpen(true)} className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">Agregar transacción rápida</button>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 text-sm text-slate-300">
              <div className="rounded-2xl bg-slate-950/60 p-4"><p className="text-slate-500">Cantidad total</p><p className="mt-2 text-white">{position.quantity}</p></div>
              <div className="rounded-2xl bg-slate-950/60 p-4"><p className="text-slate-500">Precio promedio compra</p><p className="mt-2 text-white">{formatCurrency(position.avgCost)}</p></div>
              <div className="rounded-2xl bg-slate-950/60 p-4"><p className="text-slate-500">Valor actual</p><p className="mt-2 text-white">{formatCurrency(position.currentValue)}</p></div>
              <div className="rounded-2xl bg-slate-950/60 p-4"><p className="text-slate-500">Capital invertido</p><p className="mt-2 text-white">{formatCurrency(position.totalInvested)}</p></div>
              <div className="rounded-2xl bg-slate-950/60 p-4"><p className="text-slate-500">P&L total</p><p className={`mt-2 ${(position.pnlUsd ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatCurrency(position.pnlUsd)} ({formatPercent(position.pnlPct)})</p></div>
              <div className="rounded-2xl bg-slate-950/60 p-4"><p className="text-slate-500">Primera compra</p><p className="mt-2 text-white">{formatDate(firstPurchase)}</p></div>
            </div>
          </section>

          <CandlestickChart symbol={symbol} market={position.market} height={250} />

          <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Historial de transacciones</h2>
                <p className="mt-1 text-sm text-slate-400">Podés borrar una carga errónea o usar una operación previa como base para una nueva.</p>
              </div>
              <Link href={`/portfolio/nueva-transaccion?symbol=${symbol}&market=${position.market}`} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
                Abrir formulario completo
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-400"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Cantidad</th><th className="px-4 py-3">Precio</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Notas</th><th className="px-4 py-3">Acciones</th></tr></thead>
                <tbody>
                  {(transactionsQuery.data?.data ?? []).map((transaction) => (
                    <tr key={transaction.id} className="border-t border-slate-800 transition hover:bg-slate-800/40">
                      <td className="px-4 py-4 text-slate-300">{formatDate(transaction.date)}</td>
                      <td className="px-4 py-4"><Badge label={transaction.type} variant={typeVariants[transaction.type]} /></td>
                      <td className="px-4 py-4 text-slate-300">{transaction.quantity}</td>
                      <td className="px-4 py-4 text-slate-300">{formatCurrency(transaction.priceUsd)}</td>
                      <td className="px-4 py-4 text-slate-300">{formatCurrency(transaction.totalUsd)}</td>
                      <td className="px-4 py-4 text-slate-300">{normalizeNullable(transaction.notes)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/portfolio/nueva-transaccion?symbol=${symbol}&market=${position.market}&type=${transaction.type}&quantity=${transaction.quantity}&priceUsd=${transaction.priceUsd}&fee=${transaction.fee}&notes=${encodeURIComponent(transaction.notes ?? '')}`} className="rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:text-white">
                            Repetir
                          </Link>
                          <button type="button" onClick={() => deleteTransactionMutation.mutate(transaction.id)} className="rounded-full border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:border-rose-400 hover:text-rose-200">
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="2xl:col-span-2 space-y-6">
          <RecommendationPanel recommendation={recommendationQuery.data} compact />
          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="text-lg font-semibold text-white">Score de sentimiento</h3>
            <div className="mt-4 flex items-center justify-between">
              <SentimentBadge score={sentimentQuery.data.score} signal={sentimentQuery.data.signal} size="md" />
              <span className="text-sm text-slate-400">{sentimentQuery.data.market}</span>
            </div>
          </div>
        </div>
      </div>

      {quickOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2rem] border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/50">
            <div className="flex items-center justify-between gap-4"><h3 className="text-2xl font-semibold text-white">Agregar transacción rápida</h3><button type="button" onClick={() => setQuickOpen(false)} className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300">Cerrar</button></div>
            <p className="mt-3 text-sm leading-7 text-slate-400">Usá este panel para sumar una compra o venta rápida. Si necesitás editar con más detalle, abrí el formulario completo.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <select value={quickType} onChange={(event) => setQuickType(event.target.value as 'BUY' | 'SELL')} className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white"><option value="BUY">BUY</option><option value="SELL">SELL</option></select>
              <input value={quickQuantity || ''} onChange={(event) => setQuickQuantity(Number(event.target.value))} type="number" step="0.00000001" placeholder="Cantidad" className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white" />
              <input value={quickPrice || ''} onChange={(event) => setQuickPrice(Number(event.target.value))} type="number" step="0.01" placeholder="Precio USD" className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white" />
              <input value={quickNotes} onChange={(event) => setQuickNotes(event.target.value)} placeholder="Notas" className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white" />
              <div className="md:col-span-2 rounded-2xl bg-slate-950/70 px-4 py-3 text-sm text-slate-300">Total estimado: <span className="font-medium text-white">{formatCurrency(quickQuantity * quickPrice)}</span></div>
              <div className="md:col-span-2 flex justify-end gap-3"><button type="button" onClick={() => setQuickOpen(false)} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">Cancelar</button><button type="button" onClick={() => createTransactionMutation.mutate()} className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950">Guardar</button></div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
