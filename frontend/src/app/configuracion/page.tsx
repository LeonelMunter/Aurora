'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/Badge';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useTokenStats } from '@/hooks/useTokenStats';
import { apiClient } from '@/lib/axios';
import { formatCurrency, formatDate } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/store/useAppStore';
import type { AiLimitSettings, AiModelInfo, User } from '@/types/app';

export default function ConfiguracionPage() {
  const router = useRouter();
  const logout = useAppStore((state) => state.logout);
  const portfolioQuery = usePortfolio();
  const tokenStatsQuery = useTokenStats();
  const [telegramChatId, setTelegramChatId] = useState('');
  const [limits, setLimits] = useState({ monthlyLimitUsd: 50, alertAtPct: 80, blockOnLimit: false });

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await apiClient.get<User>('/auth/profile');
      return data;
    },
    staleTime: 60000,
  });

  const modelsQuery = useQuery({
    queryKey: ['ai-models'],
    queryFn: async () => {
      const { data } = await apiClient.get<AiModelInfo[]>('/ai/models');
      return data;
    },
    staleTime: 60000,
  });

  const telegramInstructionsQuery = useQuery({
    queryKey: ['telegram-instructions'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ instructions: string }>('/alerts/telegram/setup-instructions');
      return data;
    },
    staleTime: 60000,
  });

  const updateLimitsMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.put<AiLimitSettings>('/ai/limits', limits);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai', 'stats'] });
    },
  });

  const verifyTelegramMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ valid: boolean; message: string }>('/alerts/telegram/verify', { chatId: telegramChatId });
      return data;
    },
  });

  if (profileQuery.isLoading || tokenStatsQuery.isLoading || modelsQuery.isLoading) {
    return <LoadingSpinner size="lg" text="Cargando configuración..." />;
  }

  if (profileQuery.isError || modelsQuery.isError || tokenStatsQuery.isError || !profileQuery.data || !tokenStatsQuery.data) {
    return <ErrorMessage message="No pudimos cargar la configuración." retry={() => { profileQuery.refetch(); modelsQuery.refetch(); tokenStatsQuery.refetch(); }} />;
  }

  const tokenStats = tokenStatsQuery.data;

  return (
    <div className="space-y-8">
      <PageHeader title="Configuración" subtitle="Perfil, límites de IA, Telegram y datos de soporte de la cuenta." />

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-white">Perfil y riesgo</h2>
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm text-slate-300">
          <div className="rounded-2xl bg-slate-950/70 p-4"><p className="text-slate-400">Nombre</p><p className="mt-1 text-white">{profileQuery.data.name}</p></div>
          <div className="rounded-2xl bg-slate-950/70 p-4"><p className="text-slate-400">Email</p><p className="mt-1 text-white">{profileQuery.data.email}</p></div>
          <div className="rounded-2xl bg-slate-950/70 p-4"><p className="text-slate-400">Moneda base</p><p className="mt-1 text-white">USD</p></div>
          <div className="rounded-2xl bg-slate-950/70 p-4"><p className="text-slate-400">Tolerancia al riesgo</p><p className="mt-1 text-white">Moderado</p></div>
          <div className="rounded-2xl bg-slate-950/70 p-4"><p className="text-slate-400">Horizonte temporal</p><p className="mt-1 text-white">Largo (&gt; 1 año)</p></div>
          <div className="rounded-2xl bg-slate-950/70 p-4"><p className="text-slate-400">Mercados activos</p><p className="mt-1 text-white">Cripto global, Acciones AR, Bonos, FX</p></div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-white">Límites de IA</h2>
        <div className="mt-5 grid grid-cols-[1.3fr,1fr] gap-6">
          <div className="space-y-4">
            <label className="block text-sm text-slate-300">Límite mensual en USD: ${limits.monthlyLimitUsd}
              <input type="range" min={5} max={100} value={limits.monthlyLimitUsd} onChange={(event) => setLimits((state) => ({ ...state, monthlyLimitUsd: Number(event.target.value) }))} className="mt-2 w-full" />
            </label>
            <label className="block text-sm text-slate-300">Alertar al {limits.alertAtPct}%
              <input type="range" min={50} max={90} step={10} value={limits.alertAtPct} onChange={(event) => setLimits((state) => ({ ...state, alertAtPct: Number(event.target.value) }))} className="mt-2 w-full" />
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={limits.blockOnLimit} onChange={(event) => setLimits((state) => ({ ...state, blockOnLimit: event.target.checked }))} /> Bloquear al llegar al límite</label>
            <button type="button" onClick={() => updateLimitsMutation.mutate()} className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950">Guardar límites</button>
          </div>
          <div className="rounded-3xl bg-slate-950/70 p-5">
            <p className="text-sm text-slate-400">Estado actual del mes</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(tokenStats.costThisMonth)}</p>
            <p className="mt-1 text-sm text-slate-400">de {formatCurrency(tokenStats.monthlyLimit)}</p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min((tokenStats.costThisMonth / tokenStats.monthlyLimit) * 100, 100)}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-white">Modelos de IA disponibles</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400"><tr><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Free tier</th><th className="px-4 py-3">Requests/día gratis</th><th className="px-4 py-3">Estado</th></tr></thead>
            <tbody>
              {modelsQuery.data?.map((model) => (
                <tr key={model.modelString} className="border-t border-slate-800 transition hover:bg-slate-800/40">
                  <td className="px-4 py-4 text-white">{model.provider}</td>
                  <td className="px-4 py-4 text-slate-300">{model.versionLabel}</td>
                  <td className="px-4 py-4 text-slate-300">{model.freeTierLimit ? 'Sí' : 'No'}</td>
                  <td className="px-4 py-4 text-slate-300">{model.freeTierLimit ?? ''}</td>
                  <td className="px-4 py-4"><Badge label={model.isPrimary ? 'Activo' : 'Disponible'} variant={model.isPrimary ? 'success' : 'neutral'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-slate-400">Para activar Claude o GPT hay que agregar su API key al archivo backend/.env.</p>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-white">Configuración de Telegram</h2>
        <p className="mt-3 text-sm text-slate-400">{telegramInstructionsQuery.data?.instructions ?? 'Cargando instrucciones...'}</p>
        <div className="mt-5 flex items-center gap-3">
          <input value={telegramChatId} onChange={(event) => setTelegramChatId(event.target.value)} placeholder="Chat ID de Telegram" className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white" />
          <button type="button" onClick={() => verifyTelegramMutation.mutate()} className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950">Verificar</button>
          {verifyTelegramMutation.data?.valid ? <Badge label="Conectado" variant="success" /> : null}
        </div>
        {verifyTelegramMutation.data ? <p className="mt-3 text-sm text-slate-300">{verifyTelegramMutation.data.message}</p> : null}
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-white">Información de la cuenta</h2>
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm text-slate-300">
          <div className="rounded-2xl bg-slate-950/70 p-4"><p className="text-slate-400">Email</p><p className="mt-1 text-white">{profileQuery.data.email}</p></div>
          <div className="rounded-2xl bg-slate-950/70 p-4"><p className="text-slate-400">Fecha de registro</p><p className="mt-1 text-white">{formatDate(profileQuery.data.createdAt)}</p></div>
          <div className="rounded-2xl bg-slate-950/70 p-4"><p className="text-slate-400">Portfolio ID</p><p className="mt-1 text-white">{portfolioQuery.data?.id ?? ''}</p></div>
          <div className="rounded-2xl bg-slate-950/70 p-4"><p className="text-slate-400">Proveedor activo</p><p className="mt-1 text-white">{tokenStats.provider}</p></div>
        </div>
        <button type="button" onClick={() => { logout(); router.push('/login'); }} className="mt-5 rounded-full border border-rose-500/30 px-5 py-3 text-sm font-semibold text-rose-300">Cerrar sesión</button>
      </section>
    </div>
  );
}
