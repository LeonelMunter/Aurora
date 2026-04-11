'use client';

import { Suspense, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/components/ui/Badge';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { StatCard } from '@/components/ui/StatCard';
import { apiClient } from '@/lib/axios';
import { formatCurrency, formatPercent, normalizeLatinText } from '@/lib/format';
import type { BondPrice, DolarData, MacroData } from '@/types/app';

const PAGE_SIZE = 8;

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function BonosArPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateQueryParams = useMemo(() => {
    return (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    };
  }, [pathname, router, searchParams]);

  const pageParam = searchParams.get('page');

  const bondsQuery = useQuery({
    queryKey: ['bonos-ar-bonds'],
    queryFn: async () => {
      const { data } = await apiClient.get<BondPrice[]>('/market/ar/bonds');
      return data;
    },
    staleTime: 60000,
  });

  const macroQuery = useQuery({
    queryKey: ['bonos-ar-context'],
    queryFn: async () => {
      const [dolar, macro] = await Promise.all([
        apiClient.get<DolarData>('/market/ar/dolar'),
        apiClient.get<MacroData>('/market/ar/macro'),
      ]);
      return { dolar: dolar.data, macro: macro.data };
    },
    staleTime: 60000,
  });

  if (bondsQuery.isLoading || macroQuery.isLoading) {
    return <div className="space-y-6 animate-pulse"><div className="h-24 rounded-[2rem] bg-slate-900/70" /><div className="h-[420px] rounded-[2rem] bg-slate-900/70" /><div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-[2rem] bg-slate-900/70" />)}</div></div>;
  }

  if (bondsQuery.isError || macroQuery.isError || !macroQuery.data) {
    return <ErrorMessage message="No pudimos cargar bonos y dólar MEP." retry={() => { bondsQuery.refetch(); macroQuery.refetch(); }} />;
  }

  const gap = macroQuery.data.dolar.oficial && macroQuery.data.dolar.mep
    ? ((macroQuery.data.dolar.mep - macroQuery.data.dolar.oficial) / macroQuery.data.dolar.oficial) * 100
    : null;
  const totalPages = Math.max(1, Math.ceil((bondsQuery.data ?? []).length / PAGE_SIZE));
  const page = Math.min(parsePage(pageParam), totalPages);
  const paginatedBonds = (bondsQuery.data ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-8">
      <PageHeader title="Bonos soberanos y dólar MEP" subtitle="Seguimiento público de bonos, brecha cambiaria y contexto macro argentino." />

      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-slate-400">Dólar MEP</p>
        <p className="mt-3 text-5xl font-semibold text-white">{formatCurrency(macroQuery.data.dolar.mep)}</p>
        <p className="mt-3 text-sm text-slate-300">Oficial {formatCurrency(macroQuery.data.dolar.oficial)} / Brecha {formatPercent(gap)}</p>
        <p className={`mt-2 text-sm ${((gap ?? 0) >= 0) ? 'text-emerald-300' : 'text-rose-300'}`}>{(gap ?? 0) >= 0 ? 'Presión alcista respecto al oficial' : 'Compresión reciente de la brecha'}</p>
      </section>

      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400"><tr><th className="px-4 py-3">Símbolo</th><th className="px-4 py-3">Precio ARS</th><th className="px-4 py-3">Precio USD</th><th className="px-4 py-3">Moneda</th><th className="px-4 py-3">Fuente</th><th className="px-4 py-3">Nota</th></tr></thead>
            <tbody>
              {paginatedBonds.map((bond) => (
                <tr key={bond.symbol} className={`border-t border-slate-800 transition hover:bg-slate-800/40 ${bond.source === 'FALLBACK' ? 'bg-amber-500/8' : ''}`}>
                  <td className="px-4 py-4 font-medium text-white">{bond.symbol}</td>
                  <td className="px-4 py-4 text-slate-300">{formatCurrency(bond.priceArs).replace('$', '$ARS ')}</td>
                  <td className="px-4 py-4 text-slate-300">{formatCurrency(bond.priceUsd)}</td>
                  <td className="px-4 py-4 text-slate-300">{bond.currency}</td>
                  <td className="px-4 py-4">{bond.source === 'FALLBACK' ? <Badge label="Precio referencial" variant="warning" /> : <span className="text-slate-300">{bond.source ?? '-'}</span>}</td>
                  <td className="px-4 py-4 text-slate-300">{normalizeLatinText(bond.note) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls page={page} totalPages={totalPages} onPageChange={(nextPage) => updateQueryParams({ page: String(nextPage) })} />
      </section>

      <section className="grid grid-cols-4 gap-4">
        <StatCard label="Reservas internacionales" value={macroQuery.data.macro.reservasUsd} prefix="$" className={(macroQuery.data.macro.reservasUsd ?? 99999) < 30000 ? 'border-amber-500/30' : ''} />
        <StatCard label="Tasa política" value={macroQuery.data.macro.tasaPolitica} prefix="%" />
        <StatCard label="Inflación mensual" value={macroQuery.data.macro.inflacionMensual} prefix="%" className={(macroQuery.data.macro.inflacionMensual ?? 0) > 5 ? 'border-amber-500/30' : ''} />
        <StatCard label="Inflación anual" value={macroQuery.data.macro.inflacionAnual} prefix="%" />
      </section>
    </div>
  );
}

export default function BonosArPage() {
  return (
    <Suspense fallback={<div className="h-32 animate-pulse rounded-[2rem] bg-slate-900/70" />}>
      <BonosArPageContent />
    </Suspense>
  );
}