'use client';

import { formatNumber, formatPercent } from '@/lib/format';
import type { TechnicalAnalysis } from '@/types/app';

interface IndicatorPanelProps {
  analysis: TechnicalAnalysis;
}

const tooltips = {
  rsi: 'RSI mide momentum. Menor a 30 suele sugerir sobreventa y mayor a 70, sobrecompra.',
  macd: 'MACD compara medias moviles para estimar cambios de tendencia y aceleracion.',
  bollinger: 'Las bandas de Bollinger muestran dispersion y posicion relativa del precio.',
  atr: 'ATR estima volatilidad promedio en el periodo analizado.',
  trend: 'La tendencia resume direccion, fuerza y performance reciente.',
  volume: 'Volumen relativo compara el volumen actual con el promedio reciente.',
} as const;

function tone(value: string): string {
  if (/OVERBOUGHT|BULLISH|UP|HIGH/i.test(value)) {
    return 'text-emerald-300';
  }
  if (/OVERSOLD|BEARISH|DOWN|LOW/i.test(value)) {
    return 'text-rose-300';
  }
  return 'text-slate-300';
}

export function IndicatorPanel({ analysis }: IndicatorPanelProps) {
  const items = [
    {
      key: 'rsi',
      title: 'RSI',
      value: analysis.rsi.value === null ? 'Sin datos' : formatNumber(analysis.rsi.value, 2),
      detail: analysis.rsi.message ?? analysis.rsi.signal,
    },
    {
      key: 'macd',
      title: 'MACD',
      value: analysis.macd.macd === null ? 'Sin datos' : formatNumber(analysis.macd.macd, 4),
      detail: analysis.macd.message ?? analysis.macd.trend,
    },
    {
      key: 'bollinger',
      title: 'Bollinger',
      value: analysis.bollinger.upper === null ? 'Sin datos' : analysis.bollinger.position,
      detail: analysis.bollinger.message ?? (analysis.bollinger.width === null ? 'Sin datos' : `${formatPercent(analysis.bollinger.width)} de ancho`),
    },
    {
      key: 'atr',
      title: 'ATR',
      value: analysis.atr.value === null ? 'Sin datos' : formatNumber(analysis.atr.value, 4),
      detail: analysis.atr.message ?? analysis.atr.volatility,
    },
    {
      key: 'trend',
      title: 'Tendencia',
      value: analysis.trend.days7 === null && analysis.trend.days30 === null
        ? 'Sin datos'
        : `${analysis.trend.direction} - ${analysis.trend.strength}`,
      detail: analysis.trend.message ?? (analysis.trend.days30 === null ? formatPercent(analysis.trend.days7) : formatPercent(analysis.trend.days30)),
    },
    {
      key: 'volume',
      title: 'Volumen',
      value: analysis.volume.relativeVolume === null ? 'Sin datos' : `${formatNumber(analysis.volume.relativeVolume, 2)}x promedio`,
      detail: analysis.volume.avg20 === null ? 'Sin datos' : `Promedio 20 ruedas: ${formatNumber(analysis.volume.avg20, 0)}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.key} title={tooltips[item.key as keyof typeof tooltips]} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/10 transition hover:border-slate-700">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.title}</p>
          <p className="mt-3 text-lg font-semibold text-white">{item.value}</p>
          <p className={`mt-2 text-sm ${tone(item.detail)}`}>{item.detail}</p>
        </div>
      ))}
    </div>
  );
}
