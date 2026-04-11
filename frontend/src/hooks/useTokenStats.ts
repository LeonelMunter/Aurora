'use client';

import { useEffect } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/lib/axios';
import { useAppStore } from '@/store/useAppStore';
import type { TokenStats } from '@/types/app';

export function useTokenStats(sessionId?: string): UseQueryResult<TokenStats, Error> {
  const setTokenStats = useAppStore((state) => state.setTokenStats);

  const query = useQuery<TokenStats, Error>({
    queryKey: ['ai', 'stats', sessionId ?? 'default'],
    queryFn: async () => {
      const { data } = await apiClient.get<TokenStats>('/ai/stats', {
        params: sessionId ? { sessionId } : undefined,
      });
      return data;
    },
    staleTime: 30000,
  });

  useEffect(() => {
    if (query.data) {
      setTokenStats(query.data);
    }
  }, [query.data, setTokenStats]);

  return query;
}
