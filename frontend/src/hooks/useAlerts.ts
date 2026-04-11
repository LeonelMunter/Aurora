'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/axios';
import type { AlertItem } from '@/types/app';

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data } = await apiClient.get<AlertItem[]>('/alerts');
      return data;
    },
    staleTime: 30000,
  });
}
