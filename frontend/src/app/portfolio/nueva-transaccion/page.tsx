'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Suspense, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';

import { Badge } from '@/components/ui/Badge';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePortfolio } from '@/hooks/usePortfolio';
import { usePositions } from '@/hooks/usePositions';
import { apiClient } from '@/lib/axios';
import { buildAssetOptionsFromPositions, getAssetOption, getMarketLabel } from '@/lib/assetCatalog';
import { formatCurrency, formatDateInput } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import type { AssetMarket, TransactionType } from '@/types/app';

const schema = z.object({
  type: z.enum(['BUY', 'SELL', 'STAKE', 'UNSTAKE', 'REWARD', 'TRANSFER', 'FEE']),
  assetSymbol: z.string().min(1, 'Ingresá un símbolo.').transform((value) => value.toUpperCase()),
  assetMarket: z.enum(['CRYPTO', 'STOCK_AR', 'BOND', 'FX', 'STAKING']),
  quantity: z.coerce.number().positive('Ingresá una cantidad válida.'),
  priceUsd: z.coerce.number().positive('Ingresá un precio válido.'),
  fee: z.coerce.number().min(0).optional(),
  date: z.string().min(1, 'Elegí una fecha.'),
  notes: z.string().max(500, 'Las notas no pueden superar 500 caracteres.').optional(),
});

type ManualForm = z.infer<typeof schema>;
type SubmitMode = 'save' | 'saveAndNew';

const marketOptions: AssetMarket[] = ['CRYPTO', 'STOCK_AR', 'BOND', 'FX', 'STAKING'];
const typeOptions: TransactionType[] = ['BUY', 'SELL', 'STAKE', 'UNSTAKE', 'REWARD', 'TRANSFER', 'FEE'];

function getTypeLabel(type: TransactionType): string {
  switch (type) {
    case 'BUY':
      return 'Compra';
    case 'SELL':
      return 'Venta';
    case 'STAKE':
      return 'Stake';
    case 'UNSTAKE':
      return 'Unstake';
    case 'REWARD':
      return 'Reward';
    case 'TRANSFER':
      return 'Transferencia';
    case 'FEE':
      return 'Fee';
    default:
      return type;
  }
}

function buildDefaults(searchParams: URLSearchParams): Partial<ManualForm> {
  return {
    type: (searchParams.get('type') as ManualForm['type']) || 'BUY',
    assetSymbol: searchParams.get('symbol') || '',
    assetMarket: (searchParams.get('market') as ManualForm['assetMarket']) || 'CRYPTO',
    quantity: searchParams.get('quantity') ? Number(searchParams.get('quantity')) : undefined,
    priceUsd: searchParams.get('priceUsd') ? Number(searchParams.get('priceUsd')) : undefined,
    fee: searchParams.get('fee') ? Number(searchParams.get('fee')) : 0,
    notes: searchParams.get('notes') || '',
    date: searchParams.get('date') || formatDateInput(new Date()),
  };
}

function NuevaTransaccionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'manual' | 'csv'>('manual');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [exchange, setExchange] = useState('Binance');
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [submitMode, setSubmitMode] = useState<SubmitMode>('save');
  const portfolioQuery = usePortfolio();
  const positionsQuery = usePositions(portfolioQuery.data?.id);
  const defaults = useMemo(() => buildDefaults(searchParams), [searchParams]);

  const {
    register,
    watch,
    reset,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<ManualForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: defaults.type || 'BUY',
      assetSymbol: defaults.assetSymbol || '',
      assetMarket: defaults.assetMarket || 'CRYPTO',
      quantity: defaults.quantity,
      priceUsd: defaults.priceUsd,
      fee: defaults.fee ?? 0,
      notes: defaults.notes || '',
      date: defaults.date || formatDateInput(new Date()),
    },
  });

  const type = watch('type');
  const assetSymbol = watch('assetSymbol') || '';
  const assetMarket = watch('assetMarket');
  const quantity = watch('quantity') || 0;
  const priceUsd = watch('priceUsd') || 0;
  const fee = watch('fee') || 0;
  const notes = watch('notes') || '';
  const total = useMemo(() => Number(quantity) * Number(priceUsd), [priceUsd, quantity]);
  const netTotal = useMemo(() => total + Number(fee || 0), [fee, total]);

  const assetOptions = useMemo(
    () => buildAssetOptionsFromPositions(positionsQuery.data ?? []).filter((option) => option.market === assetMarket),
    [assetMarket, positionsQuery.data],
  );

  const selectedAsset = useMemo(
    () => assetOptions.find((option) => option.symbol === assetSymbol.trim().toUpperCase()) ?? getAssetOption(assetSymbol, assetMarket),
    [assetMarket, assetOptions, assetSymbol],
  );

  const currentPosition = useMemo(
    () => (positionsQuery.data ?? []).find((position) => {
      const symbol = (position.symbol ?? position.asset?.symbol ?? '').toUpperCase();
      return symbol === assetSymbol.trim().toUpperCase() && position.market === assetMarket;
    }),
    [assetMarket, assetSymbol, positionsQuery.data],
  );

  const favoritePositions = useMemo(
    () => (positionsQuery.data ?? []).slice().sort((left, right) => (right.currentValue ?? 0) - (left.currentValue ?? 0)).slice(0, 8),
    [positionsQuery.data],
  );

  function resetForNewTransaction() {
    reset({
      type: 'BUY',
      assetSymbol: '',
      assetMarket: 'CRYPTO',
      quantity: undefined,
      priceUsd: undefined,
      fee: 0,
      notes: '',
      date: formatDateInput(new Date()),
    });
    setResultMessage(null);
  }

  function resetAfterSave(values: ManualForm, mode: SubmitMode) {
    if (mode === 'saveAndNew') {
      resetForNewTransaction();
      return;
    }

    reset({
      type: values.type,
      assetSymbol: values.assetSymbol,
      assetMarket: values.assetMarket,
      quantity: undefined,
      priceUsd: undefined,
      fee: 0,
      notes: '',
      date: formatDateInput(new Date()),
    });
  }

  const manualMutation = useMutation({
    mutationFn: async (values: ManualForm) => {
      const { data } = await apiClient.post(`/portfolio/${portfolioQuery.data?.id}/transactions`, {
        ...values,
        date: new Date(values.date).toISOString(),
      });
      return { data, values };
    },
    onSuccess: ({ values }) => {
      setResultMessage(
        submitMode === 'saveAndNew'
          ? 'Transacción registrada. El formulario quedó listo para cargar otra operación.'
          : 'Transacción registrada correctamente.',
      );
      resetAfterSave(values, submitMode);
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['wealth', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio', 'positions'] });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!csvFile) {
        throw new Error('Seleccioná un archivo CSV.');
      }
      const formData = new FormData();
      formData.append('file', csvFile);
      const { data } = await apiClient.post(`/portfolio/${portfolioQuery.data?.id}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data as { rowsOk?: number; rowsError?: number; errors?: string[] };
    },
    onSuccess: (data) => {
      setResultMessage(`${data.rowsOk ?? 0} transacciones importadas correctamente. ${data.rowsError ?? 0} filas con errores.`);
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio', 'positions'] });
    },
  });

  const primaryError =
    errors.assetSymbol?.message ||
    errors.quantity?.message ||
    errors.priceUsd?.message ||
    errors.date?.message ||
    errors.notes?.message;

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        title="Nueva transacción"
        subtitle="Carga manual o importación CSV para alimentar y corregir tu portfolio con más contexto y menos fricción."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                  return;
                }
                router.push('/portfolio');
              }}
              className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={resetForNewTransaction}
              className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Nueva transacción
            </button>
          </div>
        }
      />

      <div className="flex gap-3">
        <button type="button" onClick={() => setTab('manual')} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === 'manual' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>Carga manual</button>
        <button type="button" onClick={() => setTab('csv')} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === 'csv' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>Importar CSV</button>
      </div>

      {tab === 'manual' ? (
        <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6 shadow-[0_20px_70px_rgba(2,6,23,0.28)]">
          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-6">
              <div className="rounded-[1.6rem] border border-slate-800 bg-slate-950/50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Flujo asistido</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Cargá operaciones con contexto</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
                      Podés elegir un activo desde la lista predeterminada, reutilizar posiciones que ya tenés en cartera o completar el símbolo manualmente. Si necesitás corregir una carga anterior, también podés usar esta pantalla para registrar el ajuste.
                    </p>
                  </div>
                  <Badge label={getTypeLabel(type)} variant={type === 'SELL' ? 'danger' : 'success'} />
                </div>
              </div>

              {favoritePositions.length > 0 ? (
                <div className="rounded-[1.6rem] border border-slate-800 bg-slate-950/40 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Tus activos</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">Reutilizar un activo ya cargado</h3>
                    </div>
                    <Badge label={`${favoritePositions.length} sugeridos`} variant="neutral" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {favoritePositions.map((position) => {
                      const symbol = (position.symbol ?? position.asset?.symbol ?? '').toUpperCase();
                      return (
                        <button
                          key={`${position.market}-${symbol}`}
                          type="button"
                          onClick={() => {
                            setValue('assetSymbol', symbol, { shouldValidate: true });
                            setValue('assetMarket', position.market, { shouldValidate: true });
                          }}
                          className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-white"
                        >
                          {symbol}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <form className="space-y-5" onSubmit={handleSubmit((values) => manualMutation.mutate(values))}>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">Tipo de operación</span>
                    <select {...register('type')} className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-500">
                      {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">Mercado</span>
                    <select {...register('assetMarket')} className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-500">
                      {marketOptions.map((option) => <option key={option} value={option}>{getMarketLabel(option)}</option>)}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">Elegí desde la lista predeterminada</span>
                    <select
                      value={selectedAsset ? `${selectedAsset.market}:${selectedAsset.symbol}` : ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (!value) {
                          return;
                        }
                        const [market, symbol] = value.split(':');
                        setValue('assetMarket', market as AssetMarket, { shouldValidate: true });
                        setValue('assetSymbol', symbol, { shouldValidate: true });
                      }}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-500"
                    >
                      <option value="">Seleccionar activo</option>
                      {assetOptions.map((option) => (
                        <option key={`${option.market}-${option.symbol}`} value={`${option.market}:${option.symbol}`}>
                          {option.symbol} - {option.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">Símbolo manual</span>
                    <input {...register('assetSymbol')} placeholder="BTC, USDT, ETH, GGAL..." className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-500" />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">Cantidad de tokens</span>
                    <input {...register('quantity')} type="number" step="0.00000001" placeholder="0.50" className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-500" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">Precio por Token (USD)</span>
                    <input {...register('priceUsd')} type="number" step="0.01" placeholder="68000" className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-500" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">Fee / comisión</span>
                    <input {...register('fee')} type="number" step="0.01" placeholder="0" className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-500" />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">Fecha de la operación</span>
                    <input {...register('date')} type="date" className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-500" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">Notas</span>
                    <textarea {...register('notes')} placeholder="Ej: compra en Binance, arbitraje, ajuste manual, staking, etc." className="min-h-[120px] w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-500" />
                  </label>
                </div>

                {primaryError ? <p className="text-sm text-rose-300">{primaryError}</p> : null}

                <div className="flex flex-wrap justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setSubmitMode('saveAndNew'); void handleSubmit((values) => manualMutation.mutate(values))(); }}
                    className="rounded-full border border-cyan-500/40 px-5 py-3 text-sm font-semibold text-cyan-300 transition hover:border-cyan-400 hover:text-cyan-200"
                  >
                    Guardar y cargar otra
                  </button>
                  <button
                    type="submit"
                    onClick={() => setSubmitMode('save')}
                    className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                  >
                    Guardar transacción
                  </button>
                </div>
              </form>
            </div>

            <aside className="space-y-5">
              <div className="rounded-[1.8rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Resumen live</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Vista previa de la operación</h3>
                <div className="mt-5 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between"><span>Activo</span><span className="font-medium text-white">{assetSymbol || 'Sin definir'}</span></div>
                  <div className="flex items-center justify-between"><span>Nombre</span><span className="font-medium text-white">{selectedAsset?.name ?? 'Manual / personalizado'}</span></div>
                  <div className="flex items-center justify-between"><span>Mercado</span><span className="font-medium text-white">{getMarketLabel(assetMarket)}</span></div>
                  <div className="flex items-center justify-between"><span>Tipo</span><span className="font-medium text-white">{getTypeLabel(type)}</span></div>
                </div>
                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Subtotal</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(total)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total + fee</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(netTotal)}</p>
                  </div>
                </div>
              </div>

              {currentPosition ? (
                <div className="rounded-[1.8rem] border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm text-emerald-100">
                  <p className="text-xs uppercase tracking-[0.26em] text-emerald-300">Posición actual</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-emerald-200/70">Cantidad actual</p>
                      <p className="mt-1 font-semibold text-white">{currentPosition.quantity}</p>
                    </div>
                    <div>
                      <p className="text-emerald-200/70">Costo promedio</p>
                      <p className="mt-1 font-semibold text-white">{formatCurrency(currentPosition.avgCost)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-200/70">Valor actual</p>
                      <p className="mt-1 font-semibold text-white">{formatCurrency(currentPosition.currentValue)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-200/70">P&L</p>
                      <p className="mt-1 font-semibold text-white">{formatCurrency(currentPosition.pnlUsd)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[1.8rem] border border-slate-800 bg-slate-950/50 p-5 text-sm leading-7 text-slate-400">
                  Si el activo todavía no existe en tu portfolio, esta operación lo va a crear automáticamente en tu cartera.
                </div>
              )}

              <div className="rounded-[1.8rem] border border-slate-800 bg-slate-950/50 p-5 text-sm leading-7 text-slate-400">
                <p className="font-medium text-white">Consejo operativo</p>
                <p className="mt-2">
                  Para corregir una carga previa, podés registrar la operación correcta desde acá y eliminar la transacción equivocada desde el detalle del activo o desde el historial.
                </p>
                <p className="mt-2">
                  Notas actuales: {notes ? notes : 'sin notas todavía'}.
                </p>
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
          <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-300">Exchange / broker</span>
                <select value={exchange} onChange={(event) => setExchange(event.target.value)} className="mt-2 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white"><option>Binance</option><option>InvertirOnline</option></select>
              </label>
              <button type="button" onClick={() => setCsvFile(null)} className="rounded-full border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:text-white">
                Limpiar archivo
              </button>
            </div>
            <div className="rounded-2xl bg-slate-950/70 p-4 text-sm text-slate-300">
              <p className="font-medium text-white">Instrucciones</p>
              <p className="mt-2">{exchange === 'Binance' ? 'Exportá tu historial de trades desde Binance en formato CSV.' : 'Exportá el historial de operaciones desde InvertirOnline en formato CSV.'}</p>
            </div>
            <label className="flex min-h-[180px] cursor-pointer items-center justify-center rounded-[2rem] border border-dashed border-slate-700 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
              <input type="file" accept=".csv" className="hidden" onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} />
              {csvFile ? `Archivo listo: ${csvFile.name}` : 'Arrastrá un CSV o hacé click para seleccionarlo'}
            </label>
            {importMutation.isError ? <ErrorMessage message={(importMutation.error as Error).message} /> : null}
            <button type="button" disabled={!csvFile} onClick={() => importMutation.mutate()} className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">Importar CSV</button>
          </div>
        </section>
      )}

      {resultMessage ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">{resultMessage}</div> : null}
    </div>
  );
}


export default function NuevaTransaccionPage() {
  return (
    <Suspense fallback={<div className="h-32 animate-pulse rounded-[2rem] bg-slate-900/70" />}>
      <NuevaTransaccionPageContent />
    </Suspense>
  );
}