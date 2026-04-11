'use client';

import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { SimulatorResult } from '@/types/simulator';

interface SimulatorResultsProps {
  result: SimulatorResult;
}

interface MetricCardProps {
  label: string;
  description: string;
  value: string;
  tone?: string;
}

function MetricCard({ label, description, value, tone = 'text-slate-100' }: MetricCardProps) {
  return (
    <div className="rounded-[1.5rem] border border-slate-800 bg-slate-950/45 p-4">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span>{label}</span>
        <span className="group relative inline-flex">
          <Info className="h-4 w-4 text-slate-500" />
          <span className="pointer-events-none absolute left-1/2 top-6 z-10 hidden w-64 -translate-x-1/2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 shadow-xl group-hover:block">
            {description}
          </span>
        </span>
      </div>
      <p className={`mt-3 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export function SimulatorResults({ result }: SimulatorResultsProps) {
  const liquidationBadge = result.tradeResult?.wasLiquidated
    ? {
        tone: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
        text: `El precio tocó el nivel de liquidación en ${result.tradeResult.liquidationDate}.`,
      }
    : result.strategy === 'LONG' || result.strategy === 'SHORT'
      ? {
          tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
          text: 'Sin liquidación en este período.',
        }
      : null;

  const gridBars = (result.gridOrders ?? [])
    .filter((order) => order.type === 'SELL')
    .map((order) => ({
      date: new Date(order.executedAt * 1000).toISOString().split('T')[0],
      profit: Number(order.profit.toFixed(2)),
    }));

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/50 p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Retorno anualizado" description="El rendimiento de esta estrategia normalizado a 1 año completo." value={`${result.annualizedReturn.toFixed(2)}%`} tone={result.annualizedReturn >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
          <MetricCard label="Max Drawdown" description="La caída máxima desde el punto más alto durante el período." value={`${result.maxDrawdown.toFixed(2)}%`} tone="text-rose-300" />
          <MetricCard label="Sharpe Ratio" description="Retorno ajustado por riesgo. > 1 es bueno, > 2 es excelente." value={result.sharpeRatio.toFixed(2)} tone={result.sharpeRatio >= 1 ? 'text-emerald-300' : 'text-amber-300'} />
          <MetricCard label="Win Rate" description="Porcentaje de operaciones que terminaron en ganancia. Aplica sobre todo a Grid Bot, DCA y trading." value={`${result.winRate.toFixed(1)}%`} tone={result.winRate >= 50 ? 'text-emerald-300' : 'text-amber-300'} />
        </div>
      </div>

      {liquidationBadge ? (
        <div className={`rounded-[1.5rem] border p-5 ${liquidationBadge.tone}`}>
          <div className="flex items-start gap-3">
            {result.tradeResult?.wasLiquidated ? <AlertTriangle className="mt-0.5 h-5 w-5" /> : <CheckCircle2 className="mt-0.5 h-5 w-5" />}
            <div>
              <p className="font-semibold">{result.tradeResult?.wasLiquidated ? 'LIQUIDADO' : 'Estado del trade'}</p>
              <p className="mt-1 text-sm">{liquidationBadge.text}</p>
            </div>
          </div>
        </div>
      ) : null}

      {result.tradeResult ? (
        <div className="rounded-[2rem] border border-slate-800 bg-slate-900/50 p-6">
          <h3 className="text-lg font-semibold text-white">Detalle del trade</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Resultado" description="Estado final del trade durante el backtest." value={result.tradeResult.result} tone={result.tradeResult.result === 'TARGET_HIT' ? 'text-emerald-300' : result.tradeResult.result === 'LIQUIDATED' ? 'text-rose-300' : 'text-slate-100'} />
            <MetricCard label="Apalancamiento" description="Multiplicador de exposición usado en la simulación." value={`${result.tradeResult.leverageUsed ?? 1}x`} />
            <MetricCard label="Liquidación" description="Precio teórico donde el margen se agota por completo." value={result.tradeResult.liquidationPrice ? `$${result.tradeResult.liquidationPrice.toFixed(2)}` : 'Sin datos'} tone="text-rose-300" />
            <MetricCard label="Margen requerido" description="Capital inmovilizado como garantía para abrir la posición." value={result.tradeResult.marginRequired ? `$${result.tradeResult.marginRequired.toFixed(2)}` : 'Sin datos'} />
          </div>
        </div>
      ) : null}

      {result.strategy === 'GRID_BOT' && gridBars.length > 0 ? (
        <div className="rounded-[2rem] border border-slate-800 bg-slate-900/50 p-6">
          <h3 className="text-lg font-semibold text-white">Ganancia por grid en el tiempo</h3>
          <p className="mt-1 text-sm text-slate-400">Ayuda a ver en qué tramo del período se ejecutó la mayor parte de las ventas con ganancia.</p>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gridBars}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', color: '#e2e8f0' }} formatter={(value: number) => [`$${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`, 'Ganancia']} />
                <Bar dataKey="profit" fill="#22d3ee" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="text-lg font-semibold text-white">Resumen financiero</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Capital inicial" description="Monto base del backtest." value={`$${result.initialCapital.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`} />
          <MetricCard label="Capital final" description="Valor final de la estrategia al cierre del período." value={`$${result.finalValue.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`} tone={result.finalValue >= result.initialCapital ? 'text-emerald-300' : 'text-rose-300'} />
          <MetricCard label="P&L total" description="Ganancia o pérdida neta generada por la estrategia." value={`${result.totalPnlPct >= 0 ? '+' : ''}${result.totalPnlPct.toFixed(2)}%`} tone={result.totalPnlPct >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
          <MetricCard label="Comisiones" description="Costo estimado total de ejecución durante el período." value={`$${result.totalFees.toFixed(2)}`} />
        </div>
      </div>
    </div>
  );
}
