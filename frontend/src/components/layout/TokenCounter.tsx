'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { useTokenStats } from '@/hooks/useTokenStats';
import { formatCurrency, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';

function getProgressColor(progress: number): string {
  if (progress > 80) {
    return 'bg-rose-400';
  }

  if (progress >= 60) {
    return 'bg-amber-400';
  }

  return 'bg-emerald-400';
}

function TokenCounterSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-16 rounded-2xl bg-slate-800/60" />
      ))}
    </div>
  );
}

export function TokenCounter() {
  const [collapsed, setCollapsed] = useState(false);
  const { isLoading } = useTokenStats();
  const tokenStats = useAppStore((state) => state.tokenStats);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-emerald-400/30 bg-slate-900/95 px-4 py-2 text-sm text-emerald-300 shadow-lg shadow-slate-950/40 backdrop-blur"
      >
        Abrir Token Counter
      </button>
    );
  }

  const progress =
    tokenStats?.requestsLimit && tokenStats.requestsLimit > 0
      ? Math.min((tokenStats.requestsToday / tokenStats.requestsLimit) * 100, 100)
      : 0;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[340px] rounded-3xl border border-slate-800 bg-slate-900/95 p-5 text-sm shadow-2xl shadow-slate-950/50 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Token Counter</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Consumo IA</h3>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          Ocultar
        </button>
      </div>

      <div className="mt-5">
        {isLoading || !tokenStats ? (
          <TokenCounterSkeleton />
        ) : (
          <div className="space-y-4">
            {tokenStats.limitReached ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200">
                Límite mensual alcanzado
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-950/70 p-4">
                <p className="text-slate-400">Proveedor</p>
                <p className="mt-1 font-medium text-white">{tokenStats.provider}</p>
              </div>
              <div className="rounded-2xl bg-slate-950/70 p-4">
                <p className="text-slate-400">Versión</p>
                <p className="mt-1 font-medium text-white">{tokenStats.versionLabel}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-slate-400">Modelo</p>
                  <p className="mt-1 font-medium text-white">{tokenStats.modelString}</p>
                </div>
                <Badge
                  label={tokenStats.mode === 'FREE_TIER' ? 'FREE TIER' : 'PAID'}
                  variant={tokenStats.mode === 'FREE_TIER' ? 'success' : 'warning'}
                />
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Requests hoy</span>
                <span className="font-medium text-white">
                  {formatNumber(tokenStats.requestsToday, 0)} / {tokenStats.requestsLimit === null ? '8' : formatNumber(tokenStats.requestsLimit, 0)}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className={cn('h-full rounded-full transition-all', getProgressColor(progress))} style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-950/70 p-4">
                <p className="text-slate-400">Tokens sesión</p>
                <p className="mt-1 font-medium text-white">{formatNumber(tokenStats.tokensSession, 0)}</p>
              </div>
              <div className="rounded-2xl bg-slate-950/70 p-4">
                <p className="text-slate-400">Costo estimado</p>
                <p className="mt-1 font-medium text-white">{formatCurrency(tokenStats.costUsd)}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950/70 p-4">
              <p className="text-slate-400">Gasto del mes</p>
              <p className="mt-1 font-medium text-white">
                {formatCurrency(tokenStats.costThisMonth)} / {formatCurrency(tokenStats.monthlyLimit)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

