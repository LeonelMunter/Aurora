'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/lib/axios';
import { usePortfolio } from '@/hooks/usePortfolio';
import type { Position } from '@/types/app';

export function usePositions(portfolioId?: string): UseQueryResult<Position[], Error> {
  const portfolioQuery = usePortfolio();
  const activePortfolioId = portfolioId ?? portfolioQuery.data?.id;

  return useQuery<Position[], Error>({
    queryKey: ['portfolio', 'positions', activePortfolioId],
    queryFn: async () => {
      const { data } = await apiClient.get<Position[]>(`/portfolio/${activePortfolioId}/positions`);
      return data;
    },
    enabled: Boolean(activePortfolioId),
    staleTime: 30000,
  });
}
