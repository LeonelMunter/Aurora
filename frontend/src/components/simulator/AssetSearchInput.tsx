'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { apiClient } from '@/lib/axios';
import { formatCurrency } from '@/lib/format';
import type { AssetSearchMarket, AssetSearchResult } from '@/types/simulator';

interface AssetSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  market: AssetSearchMarket;
}

export function AssetSearchInput({ value, onChange, market }: AssetSearchInputProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const trimmed = query.trim();
      if (trimmed.length < 1) {
        setResults([]);
        setIsOpen(false);
        if (!trimmed) onChange('');
        return;
      }

      setIsLoading(true);
      try {
        const { data } = await apiClient.get<AssetSearchResult[]>('/simulator/search', { params: { q: trimmed, market } });
        setResults(data);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [market, onChange, query]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const placeholder = useMemo(() => 'Buscar activo... (BTC, GGAL, AL30)', []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(event) => {
          const nextValue = event.target.value.toUpperCase();
          setQuery(nextValue);
          onChange(nextValue);
          if (!nextValue.trim()) {
            setResults([]);
            setIsOpen(false);
          }
        }}
        onFocus={() => {
          if (results.length > 0) setIsOpen(true);
        }}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
      />

      {isOpen ? (
        <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-[1.5rem] border border-slate-800 bg-slate-950 shadow-2xl">
          {isLoading ? <div className="px-4 py-3 text-sm text-slate-400">Buscando activos...</div> : null}
          {!isLoading && results.length === 0 ? <div className="px-4 py-3 text-sm text-slate-400">No encontramos coincidencias.</div> : null}
          {!isLoading
            ? results.map((item) => (
                <button
                  key={`${item.market}-${item.symbol}`}
                  type="button"
                  onClick={() => {
                    setQuery(item.symbol);
                    onChange(item.symbol);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 text-left transition hover:bg-slate-900"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{item.symbol}</span>
                      <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-300">{item.market}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{item.name}</p>
                  </div>
                  <span className="text-sm font-medium text-cyan-300">{item.currentPrice === null ? 'Sin precio' : formatCurrency(item.currentPrice)}</span>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
