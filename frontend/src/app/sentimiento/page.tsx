'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { SentimentBadge } from '@/components/market/SentimentBadge';
import { Badge } from '@/components/ui/Badge';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { apiClient } from '@/lib/axios';
import { formatRelativeTime } from '@/lib/format';
import { useAppStore } from '@/store/useAppStore';
import type { CustomSentimentAnalysis, FearGreedData, NewsResponse, SentimentResult } from '@/types/app';

const schema = z.object({
  text: z.string().min(10, 'Pegá un texto más completo para analizar.'),
});

type FormValues = z.infer<typeof schema>;

function fearGreedColor(value: number): string {
  if (value <= 25) return 'from-rose-500 to-rose-400';
  if (value <= 45) return 'from-amber-500 to-amber-400';
  if (value <= 55) return 'from-slate-500 to-slate-400';
  if (value <= 75) return 'from-emerald-400 to-emerald-300';
  return 'from-emerald-500 to-emerald-400';
}

export default function SentimientoPage() {
  const [filters, setFilters] = useState({ source: '', sentiment: '', symbol: '', page: 1 });
  const accessToken = useAppStore((state) => state.accessToken);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const fearGreedQuery = useQuery({
    queryKey: ['sentiment-fear-greed'],
    queryFn: async () => {
      const { data } = await apiClient.get<FearGreedData | null>('/sentiment/fear-greed');
      return data;
    },
    staleTime: 60000,
  });

  const overviewQuery = useQuery({
    queryKey: ['sentiment-overview'],
    queryFn: async () => {
      const { data } = await apiClient.get<SentimentResult[]>('/sentiment/overview');
      return data;
    },
    staleTime: 30000,
  });

  const newsQuery = useQuery({
    queryKey: ['sentiment-news-feed', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<NewsResponse>('/sentiment/news', {
        params: {
          limit: 20,
          page: filters.page,
          symbol: filters.symbol || undefined,
          source: filters.source || undefined,
          sentiment: filters.sentiment || undefined,
        },
      });
      return data;
    },
    staleTime: 60000,
  });

  const analyzeMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data } = await apiClient.post<CustomSentimentAnalysis>('/sentiment/analyze', values);
      return data;
    },
  });

  if (fearGreedQuery.isLoading || overviewQuery.isLoading || newsQuery.isLoading) {
    return <div className="space-y-6 animate-pulse"><div className="h-20 rounded-3xl bg-slate-900/70" /><div className="grid grid-cols-5 gap-6"><div className="col-span-2 h-72 rounded-[2rem] bg-slate-900/70" /><div className="col-span-3 h-72 rounded-[2rem] bg-slate-900/70" /></div><div className="h-[520px] rounded-[2rem] bg-slate-900/70" /></div>;
  }

  if (fearGreedQuery.isError || overviewQuery.isError || newsQuery.isError) {
    return <ErrorMessage message="No pudimos cargar el análisis de sentimiento." retry={() => { fearGreedQuery.refetch(); overviewQuery.refetch(); newsQuery.refetch(); }} />;
  }

  const overview = [...(overviewQuery.data ?? [])].sort((left, right) => right.score - left.score).slice(0, 6);

  return (
    <div className="space-y-8">
      <PageHeader title="Análisis de sentimiento" subtitle="Fear & Greed, overview por activo, noticias y análisis custom." />

      <section className="grid grid-cols-5 gap-6">
        <article className="col-span-2 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Fear & Greed</h2>
          {fearGreedQuery.data ? (
            <div className="mt-6 flex flex-col items-center">
              <div className={`flex h-48 w-48 items-center justify-center rounded-full bg-gradient-to-br ${fearGreedColor(fearGreedQuery.data.value)} p-[1px]`}>
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-slate-950">
                  <p className="text-5xl font-semibold text-white">{fearGreedQuery.data.value}</p>
                  <p className="mt-2 text-sm text-slate-400">{fearGreedQuery.data.classification}</p>
                </div>
              </div>
            </div>
          ) : <p className="mt-6 text-sm text-slate-400">Sin datos por el momento.</p>}
        </article>

        <article className="col-span-3 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Overview</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-3">
            {overview.map((item) => (
              <div key={item.symbol} className="rounded-2xl bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{item.symbol}</p>
                  <SentimentBadge score={item.score} signal={item.signal} size="sm" />
                </div>
                <p className="mt-2 text-xs text-slate-500">{item.market}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex flex-wrap gap-3">
          <input value={filters.symbol} onChange={(event) => setFilters((state) => ({ ...state, symbol: event.target.value, page: 1 }))} placeholder="Símbolo" className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white" />
          <input value={filters.source} onChange={(event) => setFilters((state) => ({ ...state, source: event.target.value, page: 1 }))} placeholder="Fuente" className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white" />
          <select value={filters.sentiment} onChange={(event) => setFilters((state) => ({ ...state, sentiment: event.target.value, page: 1 }))} className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white"><option value="">Todos</option><option value="POSITIVE">POSITIVE</option><option value="NEUTRAL">NEUTRAL</option><option value="NEGATIVE">NEGATIVE</option></select>
        </div>
        <div className="space-y-4">
          {(newsQuery.data?.data ?? []).map((item) => (
            <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block rounded-[1.5rem] bg-slate-950/60 p-5 transition hover:bg-slate-950/80">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">{item.title}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge label={item.source} variant="neutral" />
                    {item.sentiment ? <SentimentBadge score={item.sentimentScore ?? 50} signal={item.sentiment === 'POSITIVE' ? 'BULLISH' : item.sentiment === 'NEGATIVE' ? 'BEARISH' : 'NEUTRAL'} size="sm" /> : null}
                    {(item.symbols ?? []).map((symbol) => <Badge key={symbol} label={symbol} variant="info" />)}
                  </div>
                </div>
                <p className="text-xs text-slate-500">{formatRelativeTime(item.publishedAt)}</p>
              </div>
              {item.summary ? <p className="mt-3 text-sm text-slate-300">{item.summary}</p> : null}
              {item.aiSummary ? <p className="mt-3 rounded-2xl border border-cyan-500/15 bg-cyan-500/5 px-4 py-3 text-sm text-slate-200">{item.aiSummary}</p> : null}
            </a>
          ))}
        </div>
        <button type="button" onClick={() => setFilters((state) => ({ ...state, page: state.page + 1 }))} className="mt-5 rounded-full border border-slate-700 px-5 py-3 text-sm text-slate-300">Cargar más</button>
      </section>

      {accessToken ? (
        <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Analizar texto custom</h2>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit((values) => analyzeMutation.mutate(values))}>
            <textarea {...register('text')} placeholder="Pegá un texto para analizar" className="min-h-[160px] w-full rounded-[1.5rem] border border-slate-700 bg-slate-950/80 px-4 py-4 text-white" />
            {errors.text ? <p className="text-sm text-rose-300">{errors.text.message}</p> : null}
            <button type="submit" className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950">Analizar sentimiento</button>
          </form>
          {analyzeMutation.data ? (
            <div className="mt-5 rounded-[1.5rem] bg-slate-950/60 p-5">
              <div className="flex items-center justify-between gap-3"><SentimentBadge score={analyzeMutation.data.score} signal={analyzeMutation.data.sentiment === 'POSITIVE' ? 'BULLISH' : analyzeMutation.data.sentiment === 'NEGATIVE' ? 'BEARISH' : 'NEUTRAL'} /><Badge label={analyzeMutation.data.intensity} variant="info" /></div>
              <p className="mt-4 text-sm text-slate-300">{analyzeMutation.data.summary}</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
