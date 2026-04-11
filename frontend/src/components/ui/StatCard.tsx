'use client';

import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number | string | null | undefined;
  change?: number | null;
  changeType?: 'positive' | 'negative' | 'neutral';
  prefix?: '$' | '%';
  suffix?: string;
  className?: string;
}

export function StatCard({ label, value, change, changeType = 'neutral', prefix, suffix, className }: StatCardProps) {
  const formattedValue =
    typeof value === 'number'
      ? prefix === '$'
        ? formatCurrency(value)
        : prefix === '%'
          ? formatPercent(value)
          : `${formatNumber(value)}${suffix ?? ''}`
      : value ?? '-';

  return (
    <article className={cn('rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20', className)}>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{formattedValue}</p>
      {typeof change === 'number' ? (
        <p
          className={cn(
            'mt-2 text-sm font-medium',
            changeType === 'positive' && 'text-emerald-300',
            changeType === 'negative' && 'text-rose-300',
            changeType === 'neutral' && 'text-slate-400',
          )}
        >
          {changeType === 'positive' ? '? ' : changeType === 'negative' ? '? ' : ''}
          {formatPercent(change)}
        </p>
      ) : null}
    </article>
  );
}
