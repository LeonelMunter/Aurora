'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { socket } from '@/lib/socket';
import { useAppStore } from '@/store/useAppStore';
import type { NotificationItem, TokenStats } from '@/types/app';

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const userId = useAppStore((state) => state.user?.id);

  useEffect(() => {
    if (!userId) {
      socket.disconnect();
      return;
    }

    socket.auth = { userId };
    socket.connect();

    const handlePriceUpdated = (payload: { symbol: string; price: number }) => {
      useAppStore.getState().updatePrice(payload.symbol, payload.price);
    };

    const handleTokenUpdated = (stats: TokenStats) => {
      useAppStore.getState().setTokenStats(stats);
    };

    const handleNotificationNew = (notification: NotificationItem) => {
      const store = useAppStore.getState();
      store.addNotification(notification);
      store.setUnreadCount(store.unreadCount + 1);
    };

    const handleUnreadCount = (payload: { count: number }) => {
      useAppStore.getState().setUnreadCount(payload.count);
    };

    socket.on('price.updated', handlePriceUpdated);
    socket.on('token.update', handleTokenUpdated);
    socket.on('notification.new', handleNotificationNew);
    socket.on('unread.count', handleUnreadCount);

    return () => {
      socket.off('price.updated', handlePriceUpdated);
      socket.off('token.update', handleTokenUpdated);
      socket.off('notification.new', handleNotificationNew);
      socket.off('unread.count', handleUnreadCount);
      socket.disconnect();
    };
  }, [userId]);

  return <>{children}</>;
}
