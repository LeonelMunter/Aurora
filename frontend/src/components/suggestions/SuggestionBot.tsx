'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { useSuggestionBot } from '@/hooks/useSuggestionBot';
import { formatRelativeTime, normalizeLatinText } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AssetMarket, SuggestionChatMessage } from '@/types/app';

interface SuggestionBotProps {
  isOpen: boolean;
  onClose: () => void;
  initialSymbol?: string;
  initialMarket?: AssetMarket;
  sessionId: string;
}

const quickQuestions = [
  '¿Por qué aparece en sugerencias?',
  '¿Cuáles son los riesgos?',
  '¿Es buena entrada ahora?',
  'Explicame las señales',
];

export function SuggestionBot({
  isOpen,
  onClose,
  initialSymbol,
  initialMarket,
  sessionId,
}: SuggestionBotProps) {
  const [input, setInput] = useState('');
  const [retryPayload, setRetryPayload] = useState<{ text: string; symbol?: string; market?: AssetMarket } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const {
    messages,
    isLoading,
    error,
    tokensUsed,
    setSessionId,
    loadHistory,
    sendMessage,
    clearSession,
  } = useSuggestionBot(sessionId);

  useEffect(() => {
    setSessionId(sessionId);
  }, [sessionId, setSessionId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void loadHistory(sessionId);
  }, [isOpen, sessionId, initialSymbol, initialMarket, loadHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const titleBadge = useMemo(() => (initialSymbol ? <Badge label={initialSymbol} variant="info" /> : null), [initialSymbol]);

  async function handleSend(text: string, symbol?: string, market?: AssetMarket) {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    setRetryPayload({ text: trimmed, symbol, market });
    setInput('');
    await sendMessage(trimmed, symbol, market);
  }

  async function handleClear() {
    await clearSession();
  }

  function renderMessage(message: SuggestionChatMessage) {
    const isAssistant = message.role === 'assistant';
    const content = normalizeLatinText(message.content);
    const isErrorBubble = isAssistant && content.toLowerCase().includes('no pude responder');

    return (
      <div key={message.id} className={cn('flex', isAssistant ? 'justify-start' : 'justify-end')}>
        <div
          className={cn(
            'max-w-[85%] rounded-[1.6rem] px-4 py-3 text-sm leading-6 shadow-lg',
            isAssistant ? 'bg-slate-800 text-slate-100' : 'bg-cyan-950 text-cyan-50',
            isErrorBubble && 'border border-rose-500/40 bg-rose-500/15 text-rose-100',
          )}
        >
          {isAssistant ? <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-cyan-300">Aurora</p> : null}
          <p className="whitespace-pre-wrap">{content}</p>
          <p className="mt-2 text-[11px] text-slate-400">{formatRelativeTime(message.createdAt)}</p>
          {isErrorBubble && retryPayload ? (
            <button
              type="button"
              onClick={() => void handleSend(retryPayload.text, retryPayload.symbol, retryPayload.market)}
              className="mt-3 text-xs font-semibold text-rose-200 underline underline-offset-4"
            >
              Reintentar
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[60] bg-slate-950/55 transition',
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed right-0 top-0 z-[70] flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.98))] shadow-[0_0_70px_rgba(2,6,23,0.8)] transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">Aurora</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Aurora - Asistente de análisis</h2>
            <div className="mt-3 flex items-center gap-2">{titleBadge}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            X
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden px-6 py-5">
          {initialSymbol ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {quickQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void handleSend(question, initialSymbol, initialMarket)}
                  className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                >
                  {question}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            {messages.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-slate-700 bg-slate-900/50 p-5 text-sm leading-7 text-slate-400">
                Preguntale por un activo sugerido, comparaciones, riesgos o contexto macro. Si hacés una pregunta directa sobre qué comprar, Aurora te va a responder con análisis, no con una orden de inversión.
              </div>
            ) : null}
            {messages.map(renderMessage)}
            {isLoading ? (
              <div className="flex justify-start">
                <div className="rounded-[1.6rem] bg-slate-800 px-4 py-3 text-slate-100">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-cyan-300">Aurora</p>
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.1s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <div className="mt-4 rounded-[1.8rem] border border-slate-800 bg-slate-950/80 p-4">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend(input, initialSymbol, initialMarket);
                }
              }}
              rows={Math.min(3, Math.max(1, input.split('\n').length))}
              placeholder={initialSymbol ? `Preguntale a Aurora por ${initialSymbol}...` : 'Preguntale algo a Aurora...'}
              className="w-full resize-none rounded-[1.3rem] border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">{tokensUsed} tokens usados en esta sesión</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleClear()}
                  className="rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:text-white"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend(input, initialSymbol, initialMarket)}
                  disabled={isLoading}
                  className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Enviar
                </button>
              </div>
            </div>
            {error ? <p className="mt-3 text-xs text-rose-300">{normalizeLatinText(error)}</p> : null}
          </div>
        </div>
      </aside>
    </>
  );
}

