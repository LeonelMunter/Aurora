'use client';

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { getRefreshToken, persistAuthSession } from '@/lib/auth';
import { useAppStore } from '@/store/useAppStore';
import type { AuthResponse } from '@/types/app';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type RetriableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAppStore.getState().accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      return null;
    }

    const response = await axios.post<AuthResponse>(`${baseURL}/auth/refresh`, { refreshToken });
    const { accessToken, refreshToken: nextRefreshToken, user } = response.data;

    persistAuthSession(accessToken, nextRefreshToken);
    useAppStore.getState().setToken(accessToken);
    useAppStore.getState().setUser(user);

    return accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();

        if (newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        }
      } catch {
      }
    }

    if (error.response?.status === 401) {
      useAppStore.getState().logout();

      if (typeof window !== 'undefined') {
        window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  },
);
