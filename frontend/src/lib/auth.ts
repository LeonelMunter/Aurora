'use client';

const ACCESS_TOKEN_COOKIE = 'aurora_access_token';
const REFRESH_TOKEN_STORAGE = 'aurora_refresh_token';

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(REFRESH_TOKEN_STORAGE);
}

export function setRefreshToken(token: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (token) {
    localStorage.setItem(REFRESH_TOKEN_STORAGE, token);
    return;
  }

  localStorage.removeItem(REFRESH_TOKEN_STORAGE);
}

export function syncAccessTokenCookie(token: string | null): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (!token) {
    document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    return;
  }

  document.cookie = `${ACCESS_TOKEN_COOKIE}=${token}; path=/; max-age=86400; SameSite=Lax`;
}

export function persistAuthSession(accessToken: string, refreshToken: string): void {
  syncAccessTokenCookie(accessToken);
  setRefreshToken(refreshToken);
}

export function clearAuthSession(): void {
  syncAccessTokenCookie(null);
  setRefreshToken(null);
}
