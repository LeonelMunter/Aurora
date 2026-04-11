'use client';

import { useEffect } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/lib/axios';
import { useAppStore } from '@/store/useAppStore';
import type { Portfolio } from '@/types/app';

export function usePortfolio(): UseQueryResult<Portfolio, Error> {
  const setPortfolioId = useAppStore((state) => state.setPortfolioId);
  const setPortfolio = useAppStore((state) => state.setPortfolio);

  const query = useQuery<Portfolio, Error>({
    queryKey: ['portfolio', 'default'],
    queryFn: async () => {
      const { data } = await apiClient.get<Portfolio>('/portfolio/default');
      return data;
    },
    staleTime: 60000,
  });

  useEffect(() => {
    if (query.data) {
      setPortfolio(query.data);
      setPortfolioId(query.data.id);
    }
  }, [query.data, setPortfolio, setPortfolioId]);

  return query;
}
