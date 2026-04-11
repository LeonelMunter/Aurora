'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/Badge';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAlerts } from '@/hooks/useAlerts';
import { useNotifications } from '@/hooks/useNotifications';
import { apiClient } from '@/lib/axios';
import { formatRelativeTime } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/store/useAppStore';

const schema = z.object({
  name: z.string().min(3, 'Ingresá un nombre.'),
  type: z.enum(['PRICE_ABOVE', 'PRICE_BELOW', 'SCORE_ABOVE', 'SENTIMENT_CHANGE', 'PORTFOLIO_PNL', 'TOKEN_LIMIT']),
  symbol: z.string().optional(),
  market: z.enum(['CRYPTO', 'STOCK_AR', 'BOND', 'FX', 'STAKING']).optional(),
  threshold: z.coerce.number().positive('Ingresá un umbral válido.'),
  channel: z.enum(['IN_APP', 'TELEGRAM', 'EMAIL', 'ALL']),
  telegramChatId: z.string().optional(),
  emailAddress: z.string().email('Email inválido.').optional().or(z.literal('')),
  cooldownMin: z.coerce.number().min(5).default(60),
});

type AlertForm = z.infer<typeof schema>;

export default function AlertasPage() {
  const [open, setOpen] = useState(false);
  const unreadCount = useAppStore((state) => state.unreadCount);
  const alertsQuery = useAlerts();
  const notificationsQuery = useNotifications({ limit: 5 });
  const {
    register,
    watch,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<AlertForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'PRICE_ABOVE',
      channel: 'IN_APP',
      cooldownMin: 60,
    },
  });

  const typeValue = watch('type');
  const channelValue = watch('channel');

  const createMutation = useMutation({
    mutationFn: async (values: AlertForm) => {
      const { data } = await apiClient.post('/alerts', {
        ...values,
        symbol: values.symbol || undefined,
        market: values.market || undefined,
        telegramChatId: values.telegramChatId || undefined,
        emailAddress: values.emailAddress || undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setOpen(false);
      reset();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/alerts/notifications/${id}/read`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => apiClient.patch('/alerts/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const rowMutation = useMutation({
    mutationFn: async ({ id, action, payload }: { id: string; action: 'toggle' | 'test' | 'delete'; payload?: unknown }) => {
      if (action === 'toggle') {
        const { data } = await apiClient.patch(`/alerts/${id}`, payload);
        return data;
      }
      if (action === 'test') {
        const { data } = await apiClient.post(`/alerts/${id}/test`);
        return data;
      }
      const { data } = await apiClient.delete(`/alerts/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  if (alertsQuery.isLoading || notificationsQuery.isLoading) {
    return <LoadingSpinner size="lg" text="Cargando alertas..." />;
  }

  if (alertsQuery.isError || notificationsQuery.isError) {
    return <ErrorMessage message="No pudimos cargar el panel de alertas." retry={() => { alertsQuery.refetch(); notificationsQuery.refetch(); }} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Alertas"
        subtitle="Notificaciones recientes y automatizaciones configuradas."
        actions={<button type="button" onClick={() => setOpen(true)} className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950">Nueva alerta</button>}
      />

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Notificaciones recientes <span className="ml-2 rounded-full bg-cyan-500/15 px-3 py-1 text-sm text-cyan-300">{unreadCount}</span></h2>
          <button type="button" onClick={() => markAllMutation.mutate()} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">Marcar todas como leídas</button>
        </div>
        <div className="mt-5 space-y-3">
          {(notificationsQuery.data?.data ?? []).map((notification) => (
            <div key={notification.id} className="rounded-2xl bg-slate-950/70 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-white">{notification.title}</p>
                    {!notification.isRead ? <Badge label="No leída" variant="warning" /> : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{notification.message}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(notification.createdAt)}</p>
                </div>
                {!notification.isRead ? <button type="button" onClick={() => markReadMutation.mutate(notification.id)} className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300">Marcar como leída</button> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-white">Alertas configuradas</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Activo</th>
                <th className="px-4 py-3">Umbral</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Último disparo</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(alertsQuery.data ?? []).map((alert) => (
                <tr key={alert.id} className="border-t border-slate-800 transition hover:bg-slate-800/40">
                  <td className="px-4 py-4 text-white">{alert.name}</td>
                  <td className="px-4 py-4 text-slate-300">{alert.type}</td>
                  <td className="px-4 py-4 text-slate-300">{alert.symbol ?? ''}</td>
                  <td className="px-4 py-4 text-slate-300">{alert.threshold}</td>
                  <td className="px-4 py-4 text-slate-300">{alert.channel}</td>
                  <td className="px-4 py-4"><Badge label={alert.isActive ? 'Activa' : 'Inactiva'} variant={alert.isActive ? 'success' : 'neutral'} /></td>
                  <td className="px-4 py-4 text-slate-300">{alert.lastTriggered ? formatRelativeTime(alert.lastTriggered) : ''}</td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => rowMutation.mutate({ id: alert.id, action: 'toggle', payload: { isActive: !alert.isActive } })} className="rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-300">{alert.isActive ? 'Desactivar' : 'Activar'}</button>
                      <button type="button" onClick={() => rowMutation.mutate({ id: alert.id, action: 'test' })} className="rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-300">Probar</button>
                      <button type="button" onClick={() => rowMutation.mutate({ id: alert.id, action: 'delete' })} className="rounded-full border border-rose-500/30 px-3 py-2 text-xs text-rose-300">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/50">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold text-white">Nueva alerta</h3>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300">Cerrar</button>
            </div>
            <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
              <input {...register('name')} placeholder="Nombre" className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white" />
              <select {...register('type')} className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white">
                <option value="PRICE_ABOVE">Precio arriba</option>
                <option value="PRICE_BELOW">Precio abajo</option>
                <option value="SCORE_ABOVE">Score arriba</option>
                <option value="SENTIMENT_CHANGE">Cambio sentimiento</option>
                <option value="PORTFOLIO_PNL">P&L portfolio</option>
                <option value="TOKEN_LIMIT">Límite de tokens</option>
              </select>
              {typeValue !== 'PORTFOLIO_PNL' && typeValue !== 'TOKEN_LIMIT' ? <input {...register('symbol')} placeholder="Símbolo" className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white" /> : null}
              {typeValue !== 'PORTFOLIO_PNL' && typeValue !== 'TOKEN_LIMIT' ? <select {...register('market')} className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white"><option value="">Mercado</option><option value="CRYPTO">CRYPTO</option><option value="STOCK_AR">STOCK_AR</option><option value="BOND">BOND</option><option value="FX">FX</option><option value="STAKING">STAKING</option></select> : null}
              <input {...register('threshold')} type="number" step="0.01" placeholder="Umbral" className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white" />
              <select {...register('channel')} className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white"><option value="IN_APP">IN_APP</option><option value="TELEGRAM">TELEGRAM</option><option value="EMAIL">EMAIL</option><option value="ALL">ALL</option></select>
              {channelValue === 'TELEGRAM' || channelValue === 'ALL' ? <input {...register('telegramChatId')} placeholder="Chat ID Telegram" className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white" /> : null}
              {channelValue === 'EMAIL' || channelValue === 'ALL' ? <input {...register('emailAddress')} placeholder="Email" className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white" /> : null}
              <input {...register('cooldownMin')} type="number" min={5} placeholder="Cooldown en minutos" className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white" />
              {(errors.name || errors.threshold || errors.emailAddress) ? <p className="md:col-span-2 text-sm text-rose-300">{errors.name?.message || errors.threshold?.message || errors.emailAddress?.message}</p> : null}
              <div className="md:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">Cancelar</button>
                <button type="submit" disabled={createMutation.isPending} className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950">Crear alerta</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
