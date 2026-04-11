'use client';

import React from 'react';
import { Trophy } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { SimulatorResult } from '@/types/simulator';

interface ComparisonViewProps {
  results: SimulatorResult[];
}

const STRATEGY_COLORS: Record<string, string> = {
  HOLDING: '#94a3b8',
  GRID_BOT: '#22d3ee',
  DCA: '#34d399',
  LONG: '#f59e0b',
  SHORT: '#fb7185',
  STAKING: '#c084fc',
};

export const ComparisonView: React.FC<ComparisonViewProps> = ({ results }) => {
  if (results.length === 0) {
    return (
      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-8 text-center">
        <p className="text-slate-400">Sin resultados para comparar.</p>
      </div>
    );
  }

  const portfolioData = results[0].portfolioHistory.map((_, index) => {
    const point: Record<string, string | number | undefined> = {
      date: results[0].portfolioHistory[index]?.date,
    };

    results.forEach((result) => {
      point[result.strategy] = result.portfolioHistory[index]?.portfolioValue ?? 0;
    });

    return point;
  });

  const bestResult = results.reduce((prev, current) => (current.totalPnlPct > prev.totalPnlPct ? current : prev));

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="mb-4 text-lg font-semibold text-cyan-300">Evolución del portfolio</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={portfolioData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} tick={{ fill: '#94a3b8' }} />
            <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} tick={{ fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', color: '#e2e8f0' }} formatter={(value: number) => `$${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`} />
            <Legend wrapperStyle={{ paddingTop: '20px', color: '#e2e8f0' }} iconType="line" formatter={(value) => {
              const result = results.find((item) => item.strategy === value);
              return `${value} (${result?.totalPnlPct.toFixed(1)}%)`;
            }} />
            {results.map((result) => (
              <Line key={result.strategy} type="monotone" dataKey={result.strategy} stroke={STRATEGY_COLORS[result.strategy] || '#22d3ee'} dot={false} strokeWidth={2.5} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="mb-4 text-lg font-semibold text-cyan-300">Comparativa de métricas</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Estrategia</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-400">Capital final</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-400">P&amp;L %</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-400">Retorno anualizado</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-400">Max Drawdown</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-400">Sharpe Ratio</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-400">Operaciones</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => {
              const isBest = result.totalPnlPct === bestResult.totalPnlPct;
              const bg = isBest ? 'bg-emerald-500/8' : 'hover:bg-slate-800/70';
              return (
                <tr key={result.strategy} className={`border-b border-slate-800 transition ${bg}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: STRATEGY_COLORS[result.strategy] }} />
                      <span className="font-semibold text-white">{result.strategy}</span>
                      {isBest ? <Trophy size={16} className="text-yellow-400" /> : null}
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${result.finalValue >= result.initialCapital ? 'text-emerald-300' : 'text-rose-300'}`}>${result.finalValue.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
                  <td className={`px-4 py-3 text-right font-bold ${result.totalPnlPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{result.totalPnlPct > 0 ? '+' : ''}{result.totalPnlPct.toFixed(2)}%</td>
                  <td className={`px-4 py-3 text-right ${result.annualizedReturn >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{result.annualizedReturn > 0 ? '+' : ''}{result.annualizedReturn.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right text-rose-300">-{result.maxDrawdown.toFixed(2)}%</td>
                  <td className={`px-4 py-3 text-right ${result.sharpeRatio >= 1 ? 'text-emerald-300' : result.sharpeRatio >= 0 ? 'text-amber-300' : 'text-rose-300'}`}>{result.sharpeRatio.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{result.totalTrades}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-[2rem] border border-amber-500/30 bg-amber-500/10 p-6">
        <div className="flex items-start gap-4">
          <Trophy className="flex-shrink-0 text-yellow-400" size={32} />
          <div>
            <h4 className="mb-2 text-lg font-semibold text-amber-100">Veredicto</h4>
            <p className="text-amber-50">
              Para <span className="font-bold text-white">{results[0].symbol}</span> en este período, la mejor estrategia hubiera sido <span className="font-bold text-emerald-300">{bestResult.strategy}</span> con una ganancia de <span className="font-bold text-emerald-300">{bestResult.totalPnlPct.toFixed(2)}%</span>
              {bestResult.holdingComparison ? <><span>{' '}vs </span><span className="font-bold text-slate-200">{bestResult.holdingComparison.pnlPct.toFixed(2)}%</span><span>{' '}del holding simple</span>{bestResult.holdingComparison.betterThan ? <span className="text-emerald-300"> (+{(bestResult.totalPnlPct - bestResult.holdingComparison.pnlPct).toFixed(2)}% más)</span> : null}</> : null}.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="text-lg font-semibold text-cyan-300">Detalle por estrategia</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {results.map((result) => (
            <div key={result.strategy} className="space-y-2 rounded-[1.5rem] border border-slate-800 bg-slate-950/45 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: STRATEGY_COLORS[result.strategy] }} />
                <h4 className="font-semibold text-white">{result.strategy}</h4>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Capital final:</span><span className={`font-semibold ${result.finalValue >= result.initialCapital ? 'text-emerald-300' : 'text-rose-300'}`}>${result.finalValue.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">P&amp;L:</span><span className={`font-semibold ${result.totalPnlPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{result.totalPnlPct > 0 ? '+' : ''}{result.totalPnlPct.toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Retorno anualizado:</span><span className={`font-semibold ${result.annualizedReturn >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{result.annualizedReturn > 0 ? '+' : ''}{result.annualizedReturn.toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Max Drawdown:</span><span className="font-semibold text-rose-300">-{result.maxDrawdown.toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Sharpe Ratio:</span><span className={`font-semibold ${result.sharpeRatio >= 1 ? 'text-emerald-300' : result.sharpeRatio >= 0 ? 'text-amber-300' : 'text-rose-300'}`}>{result.sharpeRatio.toFixed(2)}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
