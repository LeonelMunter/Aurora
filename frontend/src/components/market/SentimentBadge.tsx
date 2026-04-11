'use client';

import { cn } from '@/lib/utils';
import type { SentimentSignal } from '@/types/app';

interface SentimentBadgeProps {
  score: number;
  signal: string;
  size?: 'sm' | 'md' | 'lg';
}

const config: Record<SentimentSignal, { label: string; className: string }> = {
  VERY_BULLISH: { label: 'Muy alcista', className: 'bg-emerald-600/20 text-emerald-200 ring-emerald-500/30' },
  BULLISH: { label: 'Alcista', className: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25' },
  NEUTRAL: { label: 'Neutral', className: 'bg-slate-500/15 text-slate-300 ring-slate-500/25' },
  BEARISH: { label: 'Bajista', className: 'bg-amber-500/15 text-amber-300 ring-amber-500/25' },
  VERY_BEARISH: { label: 'Muy bajista', className: 'bg-rose-500/15 text-rose-300 ring-rose-500/25' },
};

const sizes = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-xs',
  lg: 'px-4 py-2 text-sm',
} as const;

export function SentimentBadge({ score, signal, size = 'md' }: SentimentBadgeProps) {
  const resolved = config[(signal as SentimentSignal) ?? 'NEUTRAL'] ?? config.NEUTRAL;
  return (
    <span className={cn('inline-flex rounded-full font-semibold ring-1', resolved.className, sizes[size])}>
      {resolved.label} ({Math.round(score)})
    </span>
  );
}
