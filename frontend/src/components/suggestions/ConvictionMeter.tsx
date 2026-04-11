'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

const sizeMap = {
  sm: { radius: 28, stroke: 5, box: 72, text: 'text-sm', label: 'text-[10px]' },
  md: { radius: 42, stroke: 7, box: 104, text: 'text-xl', label: 'text-xs' },
  lg: { radius: 56, stroke: 8, box: 132, text: 'text-3xl', label: 'text-sm' },
} as const;

function scoreColor(score: number): string {
  if (score < 40) return '#f43f5e';
  if (score < 60) return '#f97316';
  if (score < 75) return '#eab308';
  if (score < 90) return '#22c55e';
  return '#166534';
}

interface ConvictionMeterProps {
  score: number;
  size?: keyof typeof sizeMap;
}

export function ConvictionMeter({ score, size = 'md' }: ConvictionMeterProps) {
  const config = sizeMap[size];
  const normalizedScore = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * config.radius;
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimatedScore(normalizedScore));
    return () => cancelAnimationFrame(frame);
  }, [normalizedScore]);

  const dashOffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={config.box} height={config.box} viewBox={`0 0 ${config.box} ${config.box}`} className="overflow-visible">
        <circle
          cx={config.box / 2}
          cy={config.box / 2}
          r={config.radius}
          fill="none"
          stroke="rgba(148, 163, 184, 0.18)"
          strokeWidth={config.stroke}
        />
        <circle
          cx={config.box / 2}
          cy={config.box / 2}
          r={config.radius}
          fill="none"
          stroke={scoreColor(normalizedScore)}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${config.box / 2} ${config.box / 2})`}
          style={{ transition: 'stroke-dashoffset 900ms ease, stroke 300ms ease' }}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className={cn('fill-white font-semibold', config.text)}
        >
          {Math.round(normalizedScore)}
        </text>
      </svg>
      <span className={cn('uppercase tracking-[0.2em] text-slate-400', config.label)}>Convicción</span>
    </div>
  );
}

