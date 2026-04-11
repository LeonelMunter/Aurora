'use client';

import { cn } from '@/lib/utils';

const badgeVariants = {
  success: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  danger: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  info: 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30',
  neutral: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
} as const;

interface BadgeProps {
  label: string;
  variant?: keyof typeof badgeVariants;
  className?: string;
}

export function Badge({ label, variant = 'neutral', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ring-1', badgeVariants[variant], className)}>
      {label}
    </span>
  );
}
