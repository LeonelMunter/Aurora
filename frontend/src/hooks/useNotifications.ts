'use client';

import { useEffect } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/lib/axios';
import { useAppStore } from '@/store/useAppStore';
import type { NotificationsResponse } from '@/types/app';

export interface NotificationFilters {
  limit?: number;
  page?: number;
  type?: string;
  isRead?: boolean;
}

export function useNotifications(filters: NotificationFilters = {}): UseQueryResult<NotificationsResponse, Error> {
  const setNotifications = useAppStore((state) => state.setNotifications);
  const setUnreadCount = useAppStore((state) => state.setUnreadCount);

  const query = useQuery<NotificationsResponse, Error>({
    queryKey: ['notifications', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<NotificationsResponse>('/alerts/notifications', {
        params: filters,
      });
      return data;
    },
    staleTime: 30000,
  });

  useEffect(() => {
    if (query.data) {
      setNotifications(query.data.data);
      setUnreadCount(query.data.unread);
    }
  }, [query.data, setNotifications, setUnreadCount]);

  return query;
}
