'use client';

import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { SimulatorResult } from '@/types/simulator';

interface BacktestChartProps {
  result: SimulatorResult;
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Sin datos';
  return `$${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

export function BacktestChart({ result }: BacktestChartProps) {
  const chartData = useMemo(
    () => result.portfolioHistory.map((point) => ({
      ...point,
      pnlLabel: point.pnlUsd != null && point.pnlPct != null
        ? `${point.pnlUsd >= 0 ? '+' : ''}$${point.pnlUsd.toFixed(2)} (${point.pnlPct >= 0 ? '+' : ''}${point.pnlPct.toFixed(2)}%)`
        : 'Sin datos',
    })),
    [result.portfolioHistory],
  );

  const currentPrice = result.priceHistory[result.priceHistory.length - 1]?.close ?? null;
  const currentPortfolio = result.portfolioHistory[result.portfolioHistory.length - 1]?.portfolioValue ?? null;
  const gridCount = result.config.gridParams?.gridCount ?? 0;
  const totalOrders = result.gridOrders?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/45 p-4">
        <div className="flex flex-wrap gap-3 text-sm text-slate-200">
          <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-2">Precio {result.symbol}: {formatMoney(currentPrice)}</span>
          <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-2">Portfolio: {formatMoney(currentPortfolio)} ({result.totalPnlPct != null ? `${result.totalPnlPct >= 0 ? '+' : ''}${result.totalPnlPct.toFixed(2)}%` : '-'})</span>
          {result.strategy === 'GRID_BOT' ? <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-2">Grids activos: {gridCount}</span> : null}
          {result.strategy === 'GRID_BOT' ? <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-2">Órdenes ejecutadas: {totalOrders}</span> : null}
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="mb-4 text-lg font-semibold text-white">Evolución del portfolio y del activo</h3>
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis yAxisId="left" stroke="#94a3b8" />
              <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', color: '#e2e8f0', borderRadius: '12px' }}
                formatter={(value: number, name: string) => {
                  if (name === 'price') return [formatMoney(value), 'Precio del activo'];
                  if (name === 'portfolioValue') return [formatMoney(value), 'Valor del portfolio'];
                  if (name === 'pnlUsd') return [formatMoney(value), 'P&L'];
                  return [String(value), name];
                }}
                labelFormatter={(_, payload) => {
                  const point = payload?.find((item) => item?.payload)?.payload as { date?: string; price?: number; portfolioValue?: number; pnlLabel?: string; ordersExecuted?: number } | undefined;
                  if (!point) return '';
                  return [point.date ?? 'Sin fecha', `Precio ${formatMoney(point.price)}`, `Portfolio ${formatMoney(point.portfolioValue)}`, `P&L ${point.pnlLabel ?? 'Sin datos'}`, `Órdenes ${point.ordersExecuted ?? 0}`].join(' | ');
                }}
              />
              <Legend wrapperStyle={{ color: '#e2e8f0' }} />
              <Line yAxisId="left" type="monotone" dataKey="price" name={`Precio ${result.symbol}`} stroke="#22d3ee" dot={false} strokeWidth={2.5} />
              <Line yAxisId="right" type="monotone" dataKey="portfolioValue" name="Portfolio" stroke="#34d399" dot={false} strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">P&amp;L acumulado</h3>
          <span className="text-sm text-slate-400">Referencia en 0 = break-even</span>
        </div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', color: '#e2e8f0', borderRadius: '12px' }}
                formatter={(value: number, _name: string, props) => {
                  const pnlPct = typeof props.payload?.pnlPct === 'number' ? props.payload.pnlPct : null;
                  return [`${formatMoney(value)}${pnlPct === null ? '' : ` (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`}`, 'P&L acumulado'];
                }}
              />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="5 5" />
              <Area type="monotone" dataKey="pnlUsd" stroke={result.totalPnlUsd >= 0 ? '#34d399' : '#fb7185'} fill={result.totalPnlUsd >= 0 ? '#14532d' : '#4c0519'} fillOpacity={0.65} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
