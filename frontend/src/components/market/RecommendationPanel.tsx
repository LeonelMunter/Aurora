'use client';

import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { StrategyRecommendation, StrategyScore } from '@/types/app';

interface RecommendationPanelProps {
  recommendation: StrategyRecommendation;
  compact?: boolean;
}

const strategyVariants: Record<StrategyScore['strategy'], 'info' | 'success' | 'danger' | 'warning' | 'neutral'> = {
  HOLDING: 'info',
  LONG: 'success',
  SHORT: 'danger',
  GRID_BOT: 'warning',
  STAKING: 'neutral',
};

const strategyLabels: Record<StrategyScore['strategy'], string> = {
  HOLDING: 'Holding',
  LONG: 'Long',
  SHORT: 'Short',
  GRID_BOT: 'Grid Bot',
  STAKING: 'Staking',
};

const confidenceVariants = {
  HIGH: 'success',
  MEDIUM: 'warning',
  LOW: 'neutral',
} as const;

function isRiskLine(text: string): boolean {
  return /(riesgo|correccion|debil|sobrecompra|volatilidad|devaluacion|baja|soberano)/i.test(text);
}

export function RecommendationPanel({ recommendation, compact = false }: RecommendationPanelProps) {
  const orderedScores = [...recommendation.allScores].sort((left, right) => right.score - left.score);

  return (
    <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-400">Recomendacion</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Estrategia sugerida</h3>
        </div>
        <Badge
          label={strategyLabels[recommendation.topStrategy.strategy]}
          variant={strategyVariants[recommendation.topStrategy.strategy]}
          className={compact ? '' : 'px-4 py-2 text-sm'}
        />
      </div>

      <div className="mt-5 space-y-3">
        {orderedScores.map((score) => (
          <div key={score.strategy} className="rounded-2xl bg-slate-950/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-white">{strategyLabels[score.strategy]}</span>
              <div className="flex items-center gap-2">
                <Badge label={score.confidence} variant={confidenceVariants[score.confidence]} />
                <span className="text-slate-300">{score.score}/100</span>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full ${
                  score.strategy === 'LONG'
                    ? 'bg-emerald-400'
                    : score.strategy === 'SHORT'
                      ? 'bg-rose-400'
                      : score.strategy === 'GRID_BOT'
                        ? 'bg-amber-400'
                        : score.strategy === 'HOLDING'
                          ? 'bg-sky-400'
                          : 'bg-violet-400'
                }`}
                style={{ width: `${score.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {recommendation.entryPrice !== null || recommendation.targetPrice !== null || recommendation.stopLoss !== null ? (
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Entrada</p>
            <p className="mt-2 font-medium text-white">{formatCurrency(recommendation.entryPrice)}</p>
          </div>
          <div className="rounded-2xl bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Target</p>
            <p className="mt-2 font-medium text-white">{formatCurrency(recommendation.targetPrice)}</p>
          </div>
          <div className="rounded-2xl bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Stop</p>
            <p className="mt-2 font-medium text-white">{formatCurrency(recommendation.stopLoss)}</p>
            <p className="mt-2 text-xs text-cyan-300">R/R {recommendation.riskReward === null ? 'Sin datos' : formatNumber(recommendation.riskReward, 2)}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Fundamentos de la sugerencia</h4>
        <div className="mt-3 space-y-2">
          {recommendation.reasoning.map((line, index) => {
            const risk = isRiskLine(line);
            return (
              <div key={`${line}-${index}`} className="flex items-start gap-3 rounded-2xl bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${risk ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                  {risk ? '!' : '+'}
                </span>
                <span>{line}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-cyan-500/15 bg-cyan-500/5 px-4 py-4">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Capital sugerido</p>
        <p className="mt-2 text-sm text-slate-200">
          {formatCurrency(recommendation.suggestedCapital.min)} a {formatCurrency(recommendation.suggestedCapital.recommended)}
        </p>
      </div>
    </div>
  );
}
