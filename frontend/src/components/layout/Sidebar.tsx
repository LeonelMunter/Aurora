'use client';

import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { apiClient } from '@/lib/axios';
import type { Suggestion } from '@/types/app';

const navigationItems = [
  { href: '/', label: 'Dashboard', icon: 'DB' },
  { href: '/portfolio', label: 'Portfolio', icon: 'PF' },
  { href: '/patrimonio', label: 'Patrimonio', icon: 'WL' },
  { href: '/mercado', label: 'Mercado', icon: 'MK' },
  { href: '/sugerencias', label: 'Sugerencias', icon: 'SG' },
  { href: '/mercado-ar/acciones', label: 'Mercado AR', icon: 'AR' },
  { href: '/simulador', label: 'Simulador', icon: 'SM' },
  { href: '/sentimiento', label: 'Sentimiento', icon: 'SN' },
  { href: '/alertas', label: 'Alertas', icon: 'AL' },
  { href: '/configuracion', label: 'Configuracion', icon: 'CF' },
] as const;

interface SidebarProps {
  onOpenGeneralChat?: () => void;
}

export function Sidebar({ onOpenGeneralChat }: SidebarProps) {
  const pathname = usePathname();
  const suggestionsTopQuery = useQuery({
    queryKey: ['sidebar-suggestions-top'],
    queryFn: async () => {
      const { data } = await apiClient.get<Suggestion[]>('/suggestions/top', { params: { limit: 10 } });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const activeHighConvictionCount = (suggestionsTopQuery.data ?? []).filter((item) => item.convictionScore > 70).length;

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950/95 px-5 py-6 lg:block">
      <div className="flex min-h-full flex-col">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">Aurora</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Control Center</h2>
          <p className="mt-2 text-sm text-slate-400">Panel operativo para cripto, acciones AR, bonos, FX y sugerencias.</p>
        </div>

        <nav className="space-y-2">
          {navigationItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-medium">
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.href === '/sugerencias' && activeHighConvictionCount > 0 ? (
                  <span className="ml-auto rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                    {activeHighConvictionCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-8">
          <button
            type="button"
            onClick={onOpenGeneralChat}
            className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Chat general
          </button>
        </div>
      </div>
    </aside>
  );
}
