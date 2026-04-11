'use client';

import Link from 'next/link';

import { ConvictionMeter } from '@/components/suggestions/ConvictionMeter';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, normalizeLatinText } from '@/lib/format';
import { buildMarketDetailHref } from '@/lib/market';
import type { SignalBreakdown, Suggestion } from '@/types/app';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAskAurora?: () => void;
  compact?: boolean;
}

function categoryLabel(category: Suggestion['category']): string {
  switch (category) {
    case 'ESTABLISHED':
      return 'Establecido';
    case 'EMERGING':
      return 'Emergente';
    case 'RECOVERY':
      return 'Recuperacion';
    case 'LISTING_SOON':
      return 'Proximo listing';
    case 'MACRO_DRIVEN':
      return 'Macro';
    case 'TECHNICAL_SETUP':
      return 'Tecnico';
    default:
      return category;
  }
}

function marketLabel(market: Suggestion['market'], symbol: string): string {
  if (market === 'CRYPTO') return 'Cripto';
  if (market === 'BOND') return 'Bonos';
  if (market === 'FX') return 'Dolar / FX';
  if (market === 'STAKING') return 'Staking';

  const cedears = new Set(['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'META', 'KO']);
  return cedears.has(symbol) ? 'CEDEAR' : 'Acciones AR';
}

function riskVariant(riskLevel: Suggestion['riskLevel']): 'success' | 'warning' | 'danger' | 'info' {
  if (riskLevel === 'LOW') return 'success';
  if (riskLevel === 'MEDIUM') return 'info';
  if (riskLevel === 'HIGH') return 'warning';
  return 'danger';
}

function riskLabel(riskLevel: Suggestion['riskLevel']): string {
  if (riskLevel === 'LOW') return 'Bajo';
  if (riskLevel === 'MEDIUM') return 'Medio';
  if (riskLevel === 'HIGH') return 'Alto';
  return 'Muy alto';
}

function timeHorizonLabel(value: Suggestion['timeHorizon']): string {
  if (value === 'SHORT_TERM') return 'Corto plazo';
  if (value === 'MEDIUM_TERM') return 'Mediano';
  return 'Largo plazo';
}

function scoreBarClass(score: number): string {
  if (score >= 75) return 'bg-emerald-400';
  if (score >= 55) return 'bg-cyan-400';
  if (score >= 40) return 'bg-amber-400';
  return 'bg-rose-400';
}

function cleanDescription(value: string): string {
  return normalizeLatinText(value)
    .replace(/\*\*/g, '')
    .replace(/[`#_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function signalCards(signals: SignalBreakdown) {
  return [
    { label: 'Social', score: signals.social.score, meta: `${signals.social.mentions} menciones` },
    { label: 'Tecnico', score: signals.technical.score, meta: `RSI ${Math.round(signals.technical.rsi)}` },
    { label: 'Smart', score: signals.smartMoney.score, meta: signals.smartMoney.unusualVolume ? 'Volumen inusual' : 'Sin volumen inusual' },
    { label: 'Listing', score: signals.listing.score, meta: signals.listing.isNew ? 'Nuevo' : 'En seguimiento' },
    { label: 'Fundam.', score: signals.fundamental.score, meta: signals.fundamental.marketCap !== null ? 'Con market cap' : 'Sin market cap' },
    { label: 'Macro', score: signals.macro.score, meta: 'Contexto AR' },
  ];
}

function SignalMiniCard({ label, score, meta }: { label: string; score: number; meta: string }) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{label}</p>
        <span className="text-sm font-semibold text-slate-200">{safeScore}</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${scoreBarClass(safeScore)}`} style={{ width: `${safeScore}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{meta}</p>
    </div>
  );
}

export function SuggestionCard({ suggestion, onAskAurora, compact = false }: SuggestionCardProps) {
  const cards = signalCards(suggestion.signals);
  const description = cleanDescription(suggestion.narrative);
  const pros = suggestion.catalysts.length > 0
    ? suggestion.catalysts
    : [
      suggestion.signals.smartMoney.unusualVolume ? 'Se detecta volumen inusual que justifica el seguimiento.' : 'La conviccion actual mantiene el activo en seguimiento.',
      suggestion.signals.social.score >= 55 ? `El frente social acompana con ${suggestion.signals.social.mentions} menciones recientes.` : 'El setup conserva una tesis activa para monitorear.',
    ];

  return (
    <article className="flex h-full flex-col rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-3xl font-semibold tracking-tight text-white">{suggestion.symbol}</h3>
            <Badge label={marketLabel(suggestion.market, suggestion.symbol)} variant="neutral" />
          </div>
          <p className="mt-2 text-sm text-slate-400">{normalizeLatinText(suggestion.name)}</p>
        </div>
        <ConvictionMeter score={suggestion.convictionScore} size={compact ? 'sm' : 'md'} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Badge label={categoryLabel(suggestion.category)} variant="info" />
        <Badge label={timeHorizonLabel(suggestion.timeHorizon)} variant="neutral" />
        <Badge label={riskLabel(suggestion.riskLevel)} variant={riskVariant(suggestion.riskLevel)} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Precio al analisis</p>
          <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(suggestion.priceAtAnalysis)}</p>
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Objetivo</p>
          <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(suggestion.targetPrice)}</p>
        </div>
      </div>

      <div className={`mt-5 grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 xl:grid-cols-3'}`}>
        {cards.slice(0, compact ? 4 : 6).map((item) => (
          <SignalMiniCard key={item.label} label={item.label} score={item.score} meta={item.meta} />
        ))}
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-slate-800/80 bg-slate-950/40 p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Descripcion</p>
        <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
      </div>

      <div className={`mt-5 grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Catalizadores</p>
          <div className="mt-3 space-y-2 text-sm text-slate-200">
            {pros.slice(0, compact ? 2 : 3).map((item) => (
              <p key={item}>OK {normalizeLatinText(item)}</p>
            ))}
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-rose-500/20 bg-rose-500/5 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-rose-300">Riesgos</p>
          <div className="mt-3 space-y-2 text-sm text-slate-200">
            {suggestion.risks.slice(0, compact ? 2 : 3).map((item) => (
              <p key={item}>! {normalizeLatinText(item)}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 text-xs text-slate-500">Vence {formatDate(suggestion.expiresAt)}</div>

      <div className="mt-auto flex flex-wrap gap-3 pt-6">
        <Link href={buildMarketDetailHref(suggestion.symbol, suggestion.market)} className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">
          Ver analisis completo
        </Link>
        <button type="button" onClick={onAskAurora} className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200">
          Preguntar a Aurora
        </button>
      </div>
    </article>
  );
}
