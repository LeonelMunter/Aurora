'use client';

import Link from 'next/link';

import { SentimentBadge } from '@/components/market/SentimentBadge';
import { Badge } from '@/components/ui/Badge';
import { formatPercent } from '@/lib/format';

interface MarketAssetCardProps {
  href: string;
  symbol: string;
  name: string;
  marketLabel: string;
  pricePrimary: string;
  priceSecondary?: string;
  change24h?: number | null;
  change6m?: number | null;
  change1y?: number | null;
  topStrategy?: string | null;
  topScore?: number | null;
  sentimentScore?: number | null;
  sourceLabel?: string | null;
  note?: string | null;
}

function tone(value: number | null | undefined): string {
  return (value ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300';
}

function signalFromScore(score: number): 'BULLISH' | 'NEUTRAL' | 'BEARISH' {
  if (score >= 70) return 'BULLISH';
  if (score <= 35) return 'BEARISH';
  return 'NEUTRAL';
}

export function MarketAssetCard({ href, symbol, name, marketLabel, pricePrimary, priceSecondary, change24h, change6m, change1y, topStrategy, topScore, sentimentScore, sourceLabel, note }: MarketAssetCardProps) {
  const score = topScore ?? sentimentScore ?? 0;

  return (
    <Link href={href} className="group flex h-full flex-col rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.10),_transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.35)] transition duration-300 hover:-translate-y-1 hover:border-cyan-500/35">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h3 className="text-3xl font-semibold tracking-tight text-white">{symbol}</h3>
            <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{marketLabel}</span>
          </div>
          <p className="text-sm text-slate-400">{name}</p>
        </div>
        {topStrategy ? <Badge label={topStrategy} variant="info" /> : sourceLabel ? <Badge label={sourceLabel} variant="neutral" /> : null}
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-slate-800/80 bg-slate-950/40 p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Precio</p>
        <p className="mt-2 text-2xl font-semibold text-white">{pricePrimary}</p>
        {priceSecondary ? <p className="mt-2 text-sm text-slate-400">{priceSecondary}</p> : null}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">24h</p>
          <p className={`mt-2 text-sm font-semibold ${tone(change24h)}`}>{formatPercent(change24h)}</p>
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">6M</p>
          <p className={`mt-2 text-sm font-semibold ${tone(change6m)}`}>{formatPercent(change6m)}</p>
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">1Y</p>
          <p className={`mt-2 text-sm font-semibold ${tone(change1y)}`}>{formatPercent(change1y)}</p>
        </div>
      </div>

      {topScore !== null && topScore !== undefined ? (
        <div className="mt-5 rounded-[1.5rem] border border-slate-800/80 bg-slate-950/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Conviccion</p>
            <span className="text-sm font-semibold text-white">{topScore}/100</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.max(6, topScore)}%` }} />
          </div>
          <div className="mt-3">
            <SentimentBadge score={score} signal={signalFromScore(score)} size="sm" />
          </div>
        </div>
      ) : null}

      {note ? (
        <div className="mt-5 rounded-[1.5rem] border border-slate-800/80 bg-slate-950/30 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Nota</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{note}</p>
        </div>
      ) : null}

      <div className="mt-auto pt-6 text-sm font-semibold text-cyan-300">Ver detalle</div>
    </Link>
  );
}
