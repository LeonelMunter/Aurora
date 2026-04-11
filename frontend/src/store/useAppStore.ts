'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { clearAuthSession, syncAccessTokenCookie } from '@/lib/auth';
import type { NotificationItem, Portfolio, TokenStats, User } from '@/types/app';

interface AppState {
  user: User | null;
  accessToken: string | null;
  portfolioId: string | null;
  portfolio: Portfolio | null;
  tokenStats: TokenStats | null;
  notifications: NotificationItem[];
  unreadCount: number;
  prices: Map<string, number>;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setPortfolioId: (id: string | null) => void;
  setPortfolio: (portfolio: Portfolio | null) => void;
  setTokenStats: (stats: TokenStats | null) => void;
  addNotification: (notification: NotificationItem) => void;
  setNotifications: (notifications: NotificationItem[]) => void;
  setUnreadCount: (count: number) => void;
  updatePrice: (symbol: string, price: number) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      portfolioId: null,
      portfolio: null,
      tokenStats: null,
      notifications: [],
      unreadCount: 0,
      prices: new Map<string, number>(),
      setUser: (user) => set({ user }),
      setToken: (token) => {
        syncAccessTokenCookie(token);
        set({ accessToken: token });
      },
      setPortfolioId: (portfolioId) => set({ portfolioId }),
      setPortfolio: (portfolio) => set({ portfolio }),
      setTokenStats: (tokenStats) => set({ tokenStats }),
      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 20),
        })),
      setNotifications: (notifications) => set({ notifications }),
      setUnreadCount: (unreadCount) => set({ unreadCount }),
      updatePrice: (symbol, price) =>
        set((state) => {
          const prices = new Map(state.prices);
          prices.set(symbol.toUpperCase(), price);
          return { prices };
        }),
      logout: () => {
        clearAuthSession();
        set({
          user: null,
          accessToken: null,
          portfolioId: null,
          portfolio: null,
          tokenStats: null,
          notifications: [],
          unreadCount: 0,
          prices: new Map<string, number>(),
        });
      },
    }),
    {
      name: 'aurora-app-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        portfolioId: state.portfolioId,
        portfolio: state.portfolio,
        tokenStats: state.tokenStats,
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
      onRehydrateStorage: () => (state) => {
        syncAccessTokenCookie(state?.accessToken ?? null);
      },
    },
  ),
);
