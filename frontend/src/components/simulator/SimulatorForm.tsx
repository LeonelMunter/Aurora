'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, DollarSign, Grid3X3, PiggyBank, Target, TrendingUp, Zap } from 'lucide-react';

import { AssetSearchInput } from '@/components/simulator/AssetSearchInput';
import { apiClient } from '@/lib/axios';
import { formatCurrency } from '@/lib/format';
import type { AssetSearchMarket, SimulatorConfig, SimulatorMode, SimStrategy } from '@/types/simulator';
import type { StrategyRecommendation } from '@/types/app';

interface SimulatorFormProps {
  mode: SimulatorMode;
  onSubmit: (config: SimulatorConfig) => void;
  onCompare?: () => void;
  isLoading?: boolean;
  initialConfig?: Partial<SimulatorConfig>;
}

const LEVERAGE_OPTIONS = [1, 2, 3, 5, 10, 20, 50, 100] as const;

const SPOT_MARKETS: Array<{ label: string; value: AssetSearchMarket; simulatorMarket: SimulatorConfig['market'] }> = [
  { label: 'Crypto', value: 'CRYPTO', simulatorMarket: 'CRYPTO' },
  { label: 'Acciones AR', value: 'STOCK_AR', simulatorMarket: 'STOCK_AR' },
  { label: 'CEDEARs', value: 'CEDEARS', simulatorMarket: 'STOCK_AR' },
  { label: 'Bonos', value: 'BOND', simulatorMarket: 'BOND' },
];

const STRATEGIES: Record<SimulatorMode, Array<{ name: SimStrategy; label: string; description: string; icon: ReactNode }>> = {
  SPOT: [
    { name: 'HOLDING', label: 'Holding', description: 'Compra y espera', icon: <DollarSign className="h-5 w-5" /> },
    { name: 'GRID_BOT', label: 'Grid Bot', description: 'Opera por rangos', icon: <Grid3X3 className="h-5 w-5" /> },
    { name: 'DCA', label: 'DCA', description: 'Compra periódica', icon: <TrendingUp className="h-5 w-5" /> },
    { name: 'STAKING', label: 'Staking', description: 'Rinde por bloqueo', icon: <PiggyBank className="h-5 w-5" /> },
  ],
  FUTUROS: [
    { name: 'LONG', label: 'Long', description: 'Apuesta alcista', icon: <Target className="h-5 w-5" /> },
    { name: 'SHORT', label: 'Short', description: 'Apuesta bajista', icon: <Target className="h-5 w-5 rotate-180" /> },
  ],
};

const shellCard = 'rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.10),_transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.35)]';
const fieldClass = 'w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30';

export function SimulatorForm({ mode, onSubmit, onCompare, isLoading = false, initialConfig }: SimulatorFormProps) {
  const today = new Date().toISOString().split('T')[0];
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const initialMarketFilter: AssetSearchMarket = initialConfig?.market === 'BOND'
    ? 'BOND'
    : initialConfig?.market === 'STOCK_AR'
      ? 'STOCK_AR'
      : 'CRYPTO';

  const [marketFilter, setMarketFilter] = useState<AssetSearchMarket>(initialMarketFilter);
  const [config, setConfig] = useState<SimulatorConfig>({
    symbol: initialConfig?.symbol ?? 'BTC',
    market: initialConfig?.market ?? 'CRYPTO',
    strategy: initialConfig?.strategy ?? (mode === 'FUTUROS' ? 'LONG' : 'HOLDING'),
    capital: initialConfig?.capital ?? 1000,
    startDate: initialConfig?.startDate ?? oneYearAgo,
    endDate: initialConfig?.endDate ?? today,
    holdingParams: initialConfig?.holdingParams ?? {},
    gridParams: initialConfig?.gridParams ?? { rangeMin: 0, rangeMax: 0, gridCount: 20, useAutoRange: true },
    dcaParams: initialConfig?.dcaParams ?? { intervalDays: 30, amountPerBuy: 100 },
    tradeParams: initialConfig?.tradeParams ?? { entryPrice: 0, targetPrice: 0, stopLoss: 0, leverage: 1 },
    stakingParams: initialConfig?.stakingParams ?? { apyPct: 5 },
  });

  useEffect(() => {
    if (mode === 'FUTUROS') {
      setMarketFilter('CRYPTO');
      setConfig((current) => ({
        ...current,
        market: 'CRYPTO',
        strategy: current.strategy === 'LONG' || current.strategy === 'SHORT' ? current.strategy : 'LONG',
      }));
      return;
    }

    if ((marketFilter === 'STOCK_AR' || marketFilter === 'CEDEARS' || marketFilter === 'BOND') && config.strategy === 'STAKING') {
      setConfig((current) => ({ ...current, strategy: 'HOLDING' }));
    }
  }, [config.strategy, marketFilter, mode]);

  const recommendationQuery = useQuery({
    queryKey: ['simulator-recommendation', config.symbol, config.market],
    queryFn: async () => {
      const { data } = await apiClient.get<StrategyRecommendation>(`/analysis/${config.symbol}/full-recommendation`, {
        params: { market: config.market },
      });
      return data;
    },
    enabled: mode === 'FUTUROS' && config.symbol.trim().length >= 2,
    staleTime: 30000,
    retry: false,
  });

  const availableStrategies = useMemo(() => {
    if (mode === 'FUTUROS') return STRATEGIES.FUTUROS;
    if (marketFilter === 'STOCK_AR' || marketFilter === 'CEDEARS' || marketFilter === 'BOND') {
      return STRATEGIES.SPOT.filter((item) => item.name !== 'STAKING');
    }
    return STRATEGIES.SPOT;
  }, [marketFilter, mode]);

  const leverage = config.tradeParams?.leverage ?? 1;
  const leverageIndex = Math.max(0, LEVERAGE_OPTIONS.indexOf(leverage as (typeof LEVERAGE_OPTIONS)[number]));
  const entryPrice = config.tradeParams?.entryPrice ?? 0;
  const liquidationPrice = mode === 'FUTUROS' && entryPrice > 0
    ? config.strategy === 'LONG'
      ? entryPrice * (1 - 1 / leverage)
      : entryPrice * (1 + 1 / leverage)
    : null;
  const marginRequired = leverage > 0 ? config.capital / leverage : null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      ...config,
      tradeParams: config.tradeParams
        ? {
            ...config.tradeParams,
            leverage,
            liquidationPrice: liquidationPrice ?? undefined,
            marginRequired: marginRequired ?? undefined,
          }
        : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className={`${shellCard} space-y-5`}>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-cyan-300">
          <Zap className="h-5 w-5" />
          Configuración base
        </h3>

        {mode === 'SPOT' ? (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Mercado</label>
            <div className="grid grid-cols-2 gap-2">
              {SPOT_MARKETS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setMarketFilter(item.value);
                    setConfig((current) => ({ ...current, market: item.simulatorMarket }));
                  }}
                  className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${marketFilter === item.value ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-600 hover:text-white'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {marketFilter === 'STOCK_AR' || marketFilter === 'CEDEARS' || marketFilter === 'BOND' ? (
              <p className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Los activos AR se muestran en ARS. El P&amp;L se convierte a USD usando el dólar MEP.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            En futuros solo se simula CRYPTO con trading apalancado.
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">Activo</label>
          <AssetSearchInput value={config.symbol} onChange={(value) => setConfig((current) => ({ ...current, symbol: value }))} market={mode === 'FUTUROS' ? 'CRYPTO' : marketFilter} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Fecha de inicio</label>
            <input type="date" value={config.startDate} onChange={(event) => setConfig((current) => ({ ...current, startDate: event.target.value }))} className={fieldClass} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Fecha de cierre</label>
            <input type="date" value={config.endDate} onChange={(event) => setConfig((current) => ({ ...current, endDate: event.target.value }))} className={fieldClass} />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">Capital inicial (USD)</label>
          <input type="number" min="10" step="10" value={config.capital} onChange={(event) => setConfig((current) => ({ ...current, capital: Number(event.target.value) }))} className={fieldClass} />
        </div>
      </div>

      <div className={`${shellCard} space-y-5`}>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-cyan-300">
          <TrendingUp className="h-5 w-5" />
          Estrategia
        </h3>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {availableStrategies.map((strategy) => (
            <button
              key={strategy.name}
              type="button"
              onClick={() => setConfig((current) => ({ ...current, strategy: strategy.name }))}
              className={`rounded-[1.5rem] border p-4 text-left transition ${config.strategy === strategy.name ? 'border-cyan-500/40 bg-cyan-500/12 text-cyan-200' : 'border-slate-700 bg-slate-950/50 text-slate-200 hover:border-slate-600 hover:text-white'}`}
            >
              <div className="mb-2 text-cyan-300">{strategy.icon}</div>
              <div className="font-semibold">{strategy.label}</div>
              <div className="mt-1 text-xs text-slate-400">{strategy.description}</div>
            </button>
          ))}
        </div>

        {config.strategy === 'GRID_BOT' ? (
          <div className="space-y-4 rounded-[1.5rem] border border-slate-800 bg-slate-950/45 p-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={config.gridParams?.useAutoRange ?? true} onChange={(event) => setConfig((current) => ({ ...current, gridParams: { ...current.gridParams!, useAutoRange: event.target.checked } }))} />
              Rango automático
            </label>
            {!(config.gridParams?.useAutoRange ?? true) ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input type="number" placeholder="Precio mínimo" value={config.gridParams?.rangeMin ?? 0} onChange={(event) => setConfig((current) => ({ ...current, gridParams: { ...current.gridParams!, rangeMin: Number(event.target.value) } }))} className={fieldClass} />
                <input type="number" placeholder="Precio máximo" value={config.gridParams?.rangeMax ?? 0} onChange={(event) => setConfig((current) => ({ ...current, gridParams: { ...current.gridParams!, rangeMax: Number(event.target.value) } }))} className={fieldClass} />
              </div>
            ) : null}
            <div>
              <label className="mb-2 block text-sm text-slate-300">Cantidad de grids: {config.gridParams?.gridCount ?? 20}</label>
              <input type="range" min="10" max="100" value={config.gridParams?.gridCount ?? 20} onChange={(event) => setConfig((current) => ({ ...current, gridParams: { ...current.gridParams!, gridCount: Number(event.target.value) } }))} className="w-full accent-cyan-400" />
            </div>
          </div>
        ) : null}

        {config.strategy === 'DCA' ? (
          <div className="grid grid-cols-1 gap-4 rounded-[1.5rem] border border-slate-800 bg-slate-950/45 p-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-slate-300">Frecuencia</label>
              <select value={config.dcaParams?.intervalDays ?? 30} onChange={(event) => setConfig((current) => ({ ...current, dcaParams: { ...current.dcaParams!, intervalDays: Number(event.target.value) } }))} className={fieldClass}>
                <option value={7}>Semanal</option>
                <option value={14}>Cada 2 semanas</option>
                <option value={30}>Mensual</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Monto por compra</label>
              <input type="number" value={config.dcaParams?.amountPerBuy ?? 100} onChange={(event) => setConfig((current) => ({ ...current, dcaParams: { ...current.dcaParams!, amountPerBuy: Number(event.target.value) } }))} className={fieldClass} />
            </div>
          </div>
        ) : null}

        {config.strategy === 'STAKING' ? (
          <div className="rounded-[1.5rem] border border-slate-800 bg-slate-950/45 p-4">
            <label className="mb-2 block text-sm text-slate-300">APY anual</label>
            <input type="number" value={config.stakingParams?.apyPct ?? 5} onChange={(event) => setConfig((current) => ({ ...current, stakingParams: { ...current.stakingParams!, apyPct: Number(event.target.value) } }))} className={fieldClass} />
          </div>
        ) : null}

        {mode === 'FUTUROS' ? (
          <div className="space-y-4 rounded-[1.5rem] border border-slate-800 bg-slate-950/45 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <input type="number" placeholder="Precio de entrada" value={config.tradeParams?.entryPrice ?? 0} onChange={(event) => setConfig((current) => ({ ...current, tradeParams: { ...current.tradeParams!, entryPrice: Number(event.target.value) } }))} className={fieldClass} />
              <input type="number" placeholder="Objetivo" value={config.tradeParams?.targetPrice ?? 0} onChange={(event) => setConfig((current) => ({ ...current, tradeParams: { ...current.tradeParams!, targetPrice: Number(event.target.value) } }))} className={fieldClass} />
              <input type="number" placeholder="Stop loss" value={config.tradeParams?.stopLoss ?? 0} onChange={(event) => setConfig((current) => ({ ...current, tradeParams: { ...current.tradeParams!, stopLoss: Number(event.target.value) } }))} className={fieldClass} />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Apalancamiento: {leverage}x</label>
              <input type="range" min="0" max={String(LEVERAGE_OPTIONS.length - 1)} value={leverageIndex} onChange={(event) => {
                const next = LEVERAGE_OPTIONS[Number(event.target.value)] ?? 1;
                setConfig((current) => ({ ...current, tradeParams: { ...current.tradeParams!, leverage: next } }));
              }} className="w-full accent-cyan-400" />
              <div className="mt-2 flex justify-between text-xs text-slate-500">{LEVERAGE_OPTIONS.map((option) => <span key={option}>{option}x</span>)}</div>
            </div>

            {leverage > 10 ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4" /><span>Apalancamiento alto implica riesgo de liquidación. Solo para traders experimentados.</span></div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-sm text-slate-400">Precio de liquidación</p>
                <p className="mt-2 text-lg font-semibold text-rose-300">{liquidationPrice === null ? 'Sin datos' : formatCurrency(liquidationPrice)}</p>
                <p className="mt-2 text-xs text-slate-500">{config.strategy === 'LONG' ? 'Long: entrada × (1 - 1 / leverage)' : 'Short: entrada × (1 + 1 / leverage)'}</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-sm text-slate-400">Margen requerido</p>
                <p className="mt-2 text-lg font-semibold text-white">{marginRequired === null ? 'Sin datos' : formatCurrency(marginRequired)}</p>
                <p className="mt-2 text-xs text-slate-500">Con {formatCurrency(config.capital)} de capital y {leverage}x → {formatCurrency(marginRequired ?? 0)} de margen</p>
              </div>
            </div>

            <button type="button" onClick={() => {
              const recommendation = recommendationQuery.data;
              if (!recommendation) return;
              setConfig((current) => ({
                ...current,
                tradeParams: {
                  ...current.tradeParams!,
                  entryPrice: recommendation.entryPrice ?? current.tradeParams?.entryPrice ?? 0,
                  targetPrice: recommendation.targetPrice ?? current.tradeParams?.targetPrice ?? 0,
                  stopLoss: recommendation.stopLoss ?? current.tradeParams?.stopLoss ?? 0,
                },
              }));
            }} disabled={!recommendationQuery.data || recommendationQuery.isFetching} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50">
              {recommendationQuery.isFetching ? 'Buscando sugerencias...' : 'Usar rangos sugeridos por IA'}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex gap-4">
        <button type="submit" disabled={isLoading} className="flex-1 rounded-full bg-cyan-500 px-5 py-4 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60">
          <span className="inline-flex items-center gap-2"><Zap className="h-4 w-4" />{isLoading ? 'Procesando...' : 'Simular'}</span>
        </button>
        {onCompare && mode === 'SPOT' ? (
          <button type="button" onClick={onCompare} disabled={isLoading} className="flex-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 font-semibold text-emerald-200 transition hover:bg-emerald-500/15 disabled:opacity-60">
            <span className="inline-flex items-center gap-2"><ArrowRight className="h-4 w-4" />Comparar estrategias</span>
          </button>
        ) : null}
      </div>
    </form>
  );
}
