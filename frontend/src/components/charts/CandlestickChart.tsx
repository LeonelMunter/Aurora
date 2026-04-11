'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ColorType,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';

import { apiClient } from '@/lib/axios';
import { formatCurrency, formatNumber } from '@/lib/format';
import { useAppStore } from '@/store/useAppStore';
import type { AssetMarket, HistoricalCandle, PriceSnapshot } from '@/types/app';

interface CandlestickChartProps {
  symbol: string;
  market: AssetMarket;
  interval?: string;
  height?: number;
  days?: number;
  loadingMessage?: string;
  emptyMessage?: string;
}

interface CandlePoint extends CandlestickData {
  close: number;
}

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function getStepSeconds(interval: string): number {
  switch (interval) {
    case '1h':
      return 3600;
    case '4h':
      return 14400;
    case '1w':
      return 604800;
    case '1d':
    default:
      return 86400;
  }
}

function buildSimulatedCandles(basePrice: number, interval: string, symbol: string): CandlePoint[] {
  const points = interval === '1h' ? 72 : interval === '4h' ? 90 : interval === '1w' ? 52 : 90;
  const step = getStepSeconds(interval);
  const now = Math.floor(Date.now() / 1000);
  const random = seededRandom(symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + Math.round(basePrice));
  const candles: CandlePoint[] = [];

  let price = basePrice;
  for (let index = points - 1; index >= 0; index -= 1) {
    const drift = (random() - 0.48) * (interval === '1h' ? 0.015 : 0.04);
    const volatility = Math.max(basePrice * (interval === '1h' ? 0.004 : 0.012), 0.5);
    const open = price;
    const close = Math.max(0.01, open * (1 + drift));
    const high = Math.max(open, close) + random() * volatility;
    const low = Math.max(0.01, Math.min(open, close) - random() * volatility);

    candles.push({
      time: (now - step * index) as UTCTimestamp,
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
    });

    price = close;
  }

  return candles;
}

function toChartCandles(candles: HistoricalCandle[]): CandlePoint[] {
  return candles.map((candle) => ({
    time: Math.floor(candle.time / 1000) as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

function calculateBollinger(candles: CandlePoint[]) {
  return candles.map((candle, index) => {
    const slice = candles.slice(Math.max(0, index - 19), index + 1).map((item) => item.close);
    const mean = slice.reduce((sum, value) => sum + value, 0) / slice.length;
    const variance = slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / slice.length;
    const deviation = Math.sqrt(variance);

    return {
      upper: { time: candle.time, value: Number((mean + deviation * 2).toFixed(4)) },
      lower: { time: candle.time, value: Number((mean - deviation * 2).toFixed(4)) },
    };
  });
}

function calculateRsi(candles: CandlePoint[], period = 14): Array<{ time: Time; value: number }> {
  if (candles.length < period + 1) {
    return [];
  }

  const changes = candles.slice(1).map((candle, index) => candle.close - candles[index].close);
  let avgGain = 0;
  let avgLoss = 0;

  for (let index = 0; index < period; index += 1) {
    const change = changes[index] ?? 0;
    if (change >= 0) {
      avgGain += change;
    } else {
      avgLoss += Math.abs(change);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  const values: Array<{ time: Time; value: number }> = [];

  for (let index = period; index < candles.length; index += 1) {
    const change = changes[index - 1] ?? 0;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    values.push({ time: candles[index].time, value: Number((100 - 100 / (1 + rs)).toFixed(2)) });
  }

  return values;
}

function createBaseChart(container: HTMLDivElement, height: number): IChartApi {
  return createChart(container, {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#cbd5e1',
    },
    grid: {
      vertLines: { color: 'rgba(51, 65, 85, 0.35)' },
      horzLines: { color: 'rgba(51, 65, 85, 0.35)' },
    },
    rightPriceScale: {
      borderColor: 'rgba(71, 85, 105, 0.5)',
    },
    timeScale: {
      borderColor: 'rgba(71, 85, 105, 0.5)',
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: {
      vertLine: { color: 'rgba(56, 189, 248, 0.35)' },
      horzLine: { color: 'rgba(56, 189, 248, 0.35)' },
    },
    width: container.clientWidth,
    height,
  });
}

export function CandlestickChart({
  symbol,
  market,
  interval = '1d',
  height = 400,
  days,
  loadingMessage,
  emptyMessage,
}: CandlestickChartProps) {
  const marketPrice = useAppStore((state) => state.prices.get(symbol.toUpperCase()));
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const rsiContainerRef = useRef<HTMLDivElement | null>(null);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);
  const useHistoricalApi = market === 'STOCK_AR' || market === 'BOND' || typeof days === 'number';

  useEffect(() => {
    let mounted = true;

    async function loadChart() {
      setIsLoading(true);

      try {
        const { data: priceData } = await apiClient.get<PriceSnapshot>(`/market/prices/${symbol}`, {
          params: { market },
        });
        const basePrice = priceData.priceUsd ?? priceData.priceArs ?? marketPrice ?? 100;

        if (!mounted) {
          return;
        }

        setCurrentPrice(basePrice);

        if (useHistoricalApi) {
          const { data: historical } = await apiClient.get<HistoricalCandle[]>(`/analysis/${symbol}/candles`, {
            params: {
              market,
              interval: '1d',
              days: days ?? 180,
            },
            timeout: 30000,
          });

          if (!mounted) {
            return;
          }

          const nextCandles = toChartCandles(historical);
          setCandles(nextCandles);
          setHasRealData(nextCandles.length > 0);
        } else {
          setCandles(buildSimulatedCandles(basePrice, interval, symbol));
          setHasRealData(false);
        }
      } catch {
        if (!mounted) {
          return;
        }

        const fallbackPrice = marketPrice ?? 100;
        setCurrentPrice(fallbackPrice);

        if (useHistoricalApi) {
          setCandles([]);
          setHasRealData(false);
        } else {
          setCandles(buildSimulatedCandles(fallbackPrice, interval, symbol));
          setHasRealData(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadChart();

    return () => {
      mounted = false;
    };
  }, [days, interval, market, marketPrice, symbol, useHistoricalApi]);

  const livePrice = marketPrice ?? currentPrice;
  const bollinger = useMemo(() => calculateBollinger(candles), [candles]);
  const rsi = useMemo(() => calculateRsi(candles), [candles]);
  const currentRsi = rsi.at(-1)?.value ?? null;

  useEffect(() => {
    if (!chartContainerRef.current || !rsiContainerRef.current || candles.length === 0) {
      return undefined;
    }

    const mainChart = createBaseChart(chartContainerRef.current, height);
    const candleSeries = mainChart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#f43f5e',
    });
    const upperSeries = mainChart.addLineSeries({
      color: '#94a3b8',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const lowerSeries = mainChart.addLineSeries({
      color: '#64748b',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    candleSeries.setData(candles);
    upperSeries.setData(bollinger.map((item) => item.upper));
    lowerSeries.setData(bollinger.map((item) => item.lower));
    mainChart.timeScale().fitContent();

    let liveLine: ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null = null;
    if (livePrice) {
      liveLine = candleSeries.createPriceLine({
        price: livePrice,
        color: '#38bdf8',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'Actual',
      });
    }

    const rsiChart = createBaseChart(rsiContainerRef.current, 100);
    const rsiSeries = rsiChart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    rsiSeries.setData(rsi as LineData[]);
    rsiSeries.createPriceLine({ price: 30, color: 'rgba(244, 63, 94, 0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '30' });
    rsiSeries.createPriceLine({ price: 70, color: 'rgba(34, 197, 94, 0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '70' });
    rsiChart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? chartContainerRef.current?.clientWidth ?? 0;
      mainChart.applyOptions({ width });
      rsiChart.applyOptions({ width });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (liveLine) {
        candleSeries.removePriceLine(liveLine);
      }
      rsiChart.remove();
      mainChart.remove();
    };
  }, [bollinger, candles, height, livePrice, rsi]);

  if (isLoading) {
    return (
      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-400">Candlestick</p>
            <h3 className="mt-1 text-xl font-semibold text-white">{symbol} - {market}</h3>
          </div>
        </div>
        <div className="h-[320px] animate-pulse rounded-[1.5rem] bg-slate-950/50" />
        <p className="mt-4 text-sm text-slate-400">{loadingMessage ?? 'Cargando grafico...'}</p>
      </div>
    );
  }

  if (candles.length === 0) {
    return (
      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-400">Candlestick</p>
            <h3 className="mt-1 text-xl font-semibold text-white">{symbol} - {market}</h3>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Precio actual</p>
            <p className="text-lg font-semibold text-cyan-300">{formatCurrency(livePrice)}</p>
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
          {emptyMessage ?? 'Todavia no hay velas historicas suficientes para armar el grafico.'}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-400">Candlestick</p>
          <h3 className="mt-1 text-xl font-semibold text-white">{symbol} - {market}</h3>
          {hasRealData ? <p className="mt-2 text-xs text-slate-500">Fuente historica: Yahoo Finance</p> : null}
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Precio actual</p>
          <p className="text-lg font-semibold text-cyan-300">{formatCurrency(livePrice)}</p>
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full" style={{ height }} />
      <div className="mt-4 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-white">RSI visual</p>
          <p className="text-sm text-amber-300">Valor actual: {currentRsi === null ? 'Sin datos' : formatNumber(currentRsi, 2)}</p>
        </div>
        <div ref={rsiContainerRef} className="w-full" style={{ height: 100 }} />
      </div>
    </div>
  );
}
