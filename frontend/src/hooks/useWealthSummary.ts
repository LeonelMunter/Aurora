'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/lib/axios';
import { usePortfolio } from '@/hooks/usePortfolio';
import type { WealthSummary } from '@/types/app';

export function useWealthSummary(portfolioId?: string): UseQueryResult<WealthSummary, Error> {
  const portfolioQuery = usePortfolio();
  const activePortfolioId = portfolioId ?? portfolioQuery.data?.id;

  return useQuery<WealthSummary, Error>({
    queryKey: ['wealth', 'summary', activePortfolioId],
    queryFn: async () => {
      const { data } = await apiClient.get<WealthSummary>(`/portfolio/${activePortfolioId}/wealth/summary`);
      return data;
    },
    enabled: Boolean(activePortfolioId),
    staleTime: 30000,
  });
}
