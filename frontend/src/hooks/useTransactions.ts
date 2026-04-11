'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/lib/axios';
import { usePortfolio } from '@/hooks/usePortfolio';
import type { AssetMarket, PaginatedResponse, Transaction, TransactionType } from '@/types/app';

export interface TransactionFilters {
  assetSymbol?: string;
  type?: TransactionType | '';
  market?: AssetMarket | '';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export function useTransactions(filters: TransactionFilters = {}, portfolioId?: string): UseQueryResult<PaginatedResponse<Transaction>, Error> {
  const portfolioQuery = usePortfolio();
  const activePortfolioId = portfolioId ?? portfolioQuery.data?.id;

  return useQuery<PaginatedResponse<Transaction>, Error>({
    queryKey: ['portfolio', 'transactions', activePortfolioId, filters],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Transaction>>(
        `/portfolio/${activePortfolioId}/transactions`,
        { params: filters },
      );
      return data;
    },
    enabled: Boolean(activePortfolioId),
    staleTime: 30000,
  });
}
