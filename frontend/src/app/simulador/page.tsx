'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { BarChart3, Loader, TrendingUp, Zap } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { BacktestChart } from '@/components/simulator/BacktestChart';
import { ComparisonView } from '@/components/simulator/ComparisonView';
import { SimulatorForm } from '@/components/simulator/SimulatorForm';
import { SimulatorResults } from '@/components/simulator/SimulatorResults';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { apiClient } from '@/lib/axios';
import type { SimulatorConfig, SimulatorMode, SimulatorResult } from '@/types/simulator';

const STORAGE_KEY = 'aurora-simulator-last-result';

function SimuladorContent() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<SimulatorResult | null>(null);
  const [comparisonResults, setComparisonResults] = useState<SimulatorResult[]>([]);
  const [activeTab, setActiveTab] = useState<'chart' | 'results' | 'compare'>('chart');
  const [mode, setMode] = useState<SimulatorMode>('SPOT');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      setResult(JSON.parse(saved));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const initialConfig = useMemo<Partial<SimulatorConfig>>(() => {
    const symbol = searchParams.get('symbol')?.toUpperCase() ?? undefined;
    const market = (searchParams.get('market')?.toUpperCase() as SimulatorConfig['market'] | null) ?? undefined;
    return { symbol, market };
  }, [searchParams]);

  const simulateMutation = useMutation({
    mutationFn: async (config: SimulatorConfig) => {
      const { data } = await apiClient.post<SimulatorResult>('/simulator/run', config);
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      setActiveTab('chart');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },
  });

  const compareMutation = useMutation({
    mutationFn: async (configs: SimulatorConfig[]) => {
      const { data } = await apiClient.post<SimulatorResult[]>('/simulator/compare', { configs });
      return data;
    },
    onSuccess: (data) => {
      setComparisonResults(data);
      setActiveTab('compare');
    },
  });

  const handleCompare = () => {
    const baseResult = result;
    if (!baseResult) return;

    const baseConfig = {
      symbol: baseResult.symbol,
      market: baseResult.config.market,
      capital: baseResult.config.capital,
      startDate: baseResult.config.startDate,
      endDate: baseResult.config.endDate,
    };

    compareMutation.mutate([
      { ...baseConfig, strategy: 'HOLDING', holdingParams: {} },
      { ...baseConfig, strategy: 'GRID_BOT', gridParams: { rangeMin: 0, rangeMax: 0, gridCount: 20, useAutoRange: true } },
      { ...baseConfig, strategy: 'DCA', dcaParams: { intervalDays: 30, amountPerBuy: 100 } },
    ]);
  };

  const isLoading = simulateMutation.isPending || compareMutation.isPending;
  const error = simulateMutation.error || compareMutation.error;

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader title="Backtester visual" subtitle="Probá estrategias Spot y Futuros con activos cripto y argentinos usando historial real." />

        <div className="mb-8 grid gap-3 md:grid-cols-2">
          <button type="button" onClick={() => setMode('SPOT')} className={`rounded-[2rem] border p-5 text-left transition ${mode === 'SPOT' ? 'border-cyan-500/35 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/70'}`}>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">SPOT</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Mercado al contado</h2>
            <p className="mt-1 text-sm text-slate-400">Holding, Grid Bot, DCA y Staking para cripto, acciones AR, CEDEARs y bonos.</p>
          </button>
          <button type="button" onClick={() => setMode('FUTUROS')} className={`rounded-[2rem] border p-5 text-left transition ${mode === 'FUTUROS' ? 'border-rose-500/35 bg-rose-500/10' : 'border-slate-800 bg-slate-900/70'}`}>
            <p className="text-xs uppercase tracking-[0.22em] text-rose-300">FUTUROS</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Trading con apalancamiento</h2>
            <p className="mt-1 text-sm text-slate-400">Long y Short solo para cripto, con liquidación y margen calculados automáticamente.</p>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.35)]">
              <SimulatorForm mode={mode} onSubmit={(config) => simulateMutation.mutate(config)} onCompare={handleCompare} isLoading={isLoading} initialConfig={initialConfig} />
            </div>

            {result ? (
              <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.35)]">
                <h3 className="mb-4 text-lg font-semibold text-white">Resultado actual</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Capital inicial</span><span className="font-medium text-slate-100">${result.initialCapital.toLocaleString('es-AR')}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Capital final</span><span className="font-medium text-slate-100">${result.finalValue?.toLocaleString('es-AR') ?? '-'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">P&amp;L</span><span className={`font-medium ${result.totalPnlPct != null && result.totalPnlPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{result.totalPnlPct != null ? `${result.totalPnlPct >= 0 ? '+' : ''}${result.totalPnlPct.toFixed(2)}%` : '-'}</span></div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-2">
            {!result ? (
              <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-8 shadow-[0_24px_70px_rgba(2,6,23,0.35)]">
                <div className="mb-8 text-center">
                  <TrendingUp className="mx-auto mb-4 h-16 w-16 text-cyan-300" />
                  <h2 className="text-2xl font-bold text-white">Simulá tu próxima inversión</h2>
                  <p className="mx-auto mt-2 max-w-xl text-slate-400">Probá diferentes estrategias con datos históricos reales y medí riesgo, drawdown, Sharpe y resultado final con mayor claridad.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/50 p-5">
                    <Zap className="mb-3 h-8 w-8 text-cyan-300" />
                    <h3 className="font-semibold text-white">Spot y Futuros</h3>
                    <p className="mt-1 text-sm text-slate-400">Separados para que el formulario cambie según el riesgo y la operativa real.</p>
                  </div>
                  <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950/50 p-5">
                    <BarChart3 className="mb-3 h-8 w-8 text-emerald-300" />
                    <h3 className="font-semibold text-white">Activos AR incluidos</h3>
                    <p className="mt-1 text-sm text-slate-400">Acciones, CEDEARs y bonos con historial real cuando ya existe o se carga desde Yahoo Finance.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-1 shadow-[0_24px_70px_rgba(2,6,23,0.35)]">
                  <div className="flex">
                    {[
                      { key: 'chart', label: 'Gráfico', icon: BarChart3 },
                      { key: 'results', label: 'Resultados', icon: TrendingUp },
                      { key: 'compare', label: 'Comparar', icon: Zap },
                    ].map(({ key, label, icon: Icon }) => (
                      <button key={key} type="button" onClick={() => setActiveTab(key as 'chart' | 'results' | 'compare')} className={`flex flex-1 items-center justify-center gap-2 rounded-[1.5rem] px-4 py-3 text-sm font-medium transition ${activeTab === key ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 shadow-[0_24px_70px_rgba(2,6,23,0.35)]">
                  {activeTab === 'chart' ? <div className="p-6"><BacktestChart result={result} /></div> : null}
                  {activeTab === 'results' ? <div className="p-6"><SimulatorResults result={result} /></div> : null}
                  {activeTab === 'compare' ? (
                    <div className="p-6">
                      {comparisonResults.length > 0 ? (
                        <ComparisonView results={comparisonResults} />
                      ) : (
                        <div className="py-12 text-center">
                          <BarChart3 className="mx-auto mb-4 h-12 w-12 text-slate-500" />
                          <h3 className="text-lg font-medium text-white">Compará estrategias</h3>
                          <p className="mt-2 text-slate-400">Ejecutá Holding, Grid Bot y DCA sobre el mismo activo para ver cuál rindió mejor.</p>
                          <button type="button" onClick={handleCompare} disabled={isLoading} className="mt-6 inline-flex items-center gap-2 rounded-full bg-cyan-500 px-5 py-3 text-sm font-medium text-slate-950">
                            {isLoading ? <><Loader className="h-4 w-4 animate-spin" />Comparando...</> : <><Zap className="h-4 w-4" />Comparar estrategias</>}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {error ? <ErrorMessage title="Error en la simulación" message={error.message || 'Ocurrió un error al procesar la simulación. Revisá los parámetros e intentá de nuevo.'} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SimuladorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <SimuladorContent />
    </Suspense>
  );
}
