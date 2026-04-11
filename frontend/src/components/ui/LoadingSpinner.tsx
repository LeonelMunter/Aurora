'use client';

import { cn } from '@/lib/utils';

const sizeClasses = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-4',
} as const;

interface LoadingSpinnerProps {
  size?: keyof typeof sizeClasses;
  text?: string;
  className?: string;
}

export function LoadingSpinner({ size = 'md', text = 'Cargando...', className }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex min-h-[180px] flex-col items-center justify-center gap-4 text-slate-300', className)}>
      <div className={cn('animate-spin rounded-full border-cyan-400 border-t-transparent', sizeClasses[size])} />
      {text ? <p className="text-sm text-slate-400">{text}</p> : null}
    </div>
  );
}
