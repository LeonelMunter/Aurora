'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useWealthSummary } from '@/hooks/useWealthSummary';
import { formatCurrency, formatPercent } from '@/lib/format';

export default function PortfolioSymbolPage() {
  const params = useParams<{ symbol: string }>();
  const portfolioQuery = usePortfolio();
  const summaryQuery = useWealthSummary(portfolioQuery.data?.id);

  if (portfolioQuery.isLoading || summaryQuery.isLoading) {
    return <LoadingSpinner text="Cargando detalle de posición..." />;
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return <ErrorMessage message="No pudimos cargar el detalle del activo." retry={() => summaryQuery.refetch()} />;
  }

  const symbol = params.symbol.toUpperCase();
  const position = summaryQuery.data.positions.find((item) => (item.symbol ?? item.asset?.symbol ?? '').toUpperCase() === symbol);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Detalle de ${symbol}`}
        subtitle="Vista resumida para las filas clickeables del portfolio."
        actions={<Link href="/portfolio" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">Volver</Link>}
      />
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        {position ? (
          <div className="grid grid-cols-2 gap-6 text-sm text-slate-300">
            <p>Mercado: <span className="font-medium text-white">{position.market}</span></p>
            <p>Cantidad: <span className="font-medium text-white">{position.quantity}</span></p>
            <p>Promedio compra: <span className="font-medium text-white">{formatCurrency(position.avgCost)}</span></p>
            <p>Precio actual: <span className="font-medium text-white">{formatCurrency(position.currentPrice)}</span></p>
            <p>Valor actual: <span className="font-medium text-white">{formatCurrency(position.currentValue)}</span></p>
            <p>P&L: <span className="font-medium text-white">{formatCurrency(position.pnlUsd)} ({formatPercent(position.pnlPct)})</span></p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No encontramos una posición activa para {symbol}.</p>
        )}
      </div>
    </div>
  );
}
