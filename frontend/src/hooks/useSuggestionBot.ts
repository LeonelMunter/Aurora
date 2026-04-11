'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiClient } from '@/lib/axios';
import type { AssetMarket, SuggestionChatMessage } from '@/types/app';

interface ChatResponse {
  response: string;
  sessionId: string;
  tokensUsed: number;
}

export function useSuggestionBot(initialSessionId?: string) {
  const [messages, setMessages] = useState<SuggestionChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSessionId) {
      setSessionId(initialSessionId);
    }
  }, [initialSessionId]);

  const tokensUsed = useMemo(
    () => messages.reduce((sum, message) => sum + (message.tokensUsed ?? 0), 0),
    [messages],
  );

  const loadHistory = useCallback(async (targetSessionId: string): Promise<void> => {
    if (!targetSessionId) {
      return;
    }

    const { data } = await apiClient.get<SuggestionChatMessage[]>(`/suggestions/chat/${targetSessionId}`);
    setMessages(data);
  }, []);

  const sendMessage = useCallback(async (text: string, symbol?: string, market?: AssetMarket): Promise<void> => {
    const content = text.trim();
    if (!content || !sessionId) {
      return;
    }

    const optimisticMessage: SuggestionChatMessage = {
      id: `temp-user-${Date.now()}`,
      sessionId,
      symbol: symbol ?? null,
      market: market ?? null,
      role: 'user',
      content,
      tokensUsed: 0,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const { data } = await apiClient.post<ChatResponse>('/suggestions/chat', {
        message: content,
        sessionId,
        symbol,
        market,
      });

      setMessages((prev) => [
        ...prev.filter((message) => message.id !== optimisticMessage.id),
        optimisticMessage,
        {
          id: `temp-assistant-${Date.now()}`,
          sessionId: data.sessionId,
          symbol: symbol ?? null,
          market: market ?? null,
          role: 'assistant',
          content: data.response,
          tokensUsed: data.tokensUsed,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo contactar al bot.';
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `temp-error-${Date.now()}`,
          sessionId,
          symbol: symbol ?? null,
          market: market ?? null,
          role: 'assistant',
          content: `No pude responder en este momento. ${message}`,
          tokensUsed: 0,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const clearSession = useCallback(async (): Promise<void> => {
    if (!sessionId) {
      return;
    }

    await apiClient.delete(`/suggestions/chat/${sessionId}`);
    setMessages([]);
    setError(null);
  }, [sessionId]);

  return {
    messages,
    isLoading,
    error,
    sessionId,
    tokensUsed,
    setSessionId,
    setMessages,
    loadHistory,
    sendMessage,
    clearSession,
  };
}
