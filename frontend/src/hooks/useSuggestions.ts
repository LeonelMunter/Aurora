'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/lib/axios';
import type { AssetMarket, RiskLevel, Suggestion, SuggestionCategory, TimeHorizon } from '@/types/app';

export interface SuggestionFilters {
  market?: AssetMarket | 'CEDEARS';
  category?: SuggestionCategory;
  riskLevel?: RiskLevel;
  timeHorizon?: TimeHorizon;
  minScore?: number;
  limit?: number;
}

export function useSuggestions(filters: SuggestionFilters): UseQueryResult<Suggestion[], Error> {
  return useQuery<Suggestion[], Error>({
    queryKey: ['suggestions', filters],
    queryFn: async () => {
      const params: Record<string, string | number> = {};

      if (filters.market && filters.market !== 'CEDEARS') {
        params.market = filters.market;
      }
      if (filters.category) {
        params.category = filters.category;
      }
      if (filters.riskLevel) {
        params.riskLevel = filters.riskLevel;
      }
      if (filters.timeHorizon) {
        params.timeHorizon = filters.timeHorizon;
      }
      if (typeof filters.minScore === 'number') {
        params.minScore = filters.minScore;
      }
      if (typeof filters.limit === 'number') {
        params.limit = filters.limit;
      }

      const { data } = await apiClient.get<Suggestion[]>('/suggestions', { params });
      return filters.market === 'CEDEARS'
        ? data.filter((item) => ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'META', 'AMZN', 'BABA', 'DISN', 'KO'].includes(item.symbol))
        : data;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
