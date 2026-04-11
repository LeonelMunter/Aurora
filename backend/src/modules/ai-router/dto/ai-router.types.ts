export type TaskType =
  | 'FILTER_RELEVANCE'
  | 'SENTIMENT_NEWS'
  | 'SUMMARIZE'
  | 'RECOMMENDATION'
  | 'WEB_SEARCH'
  | 'FULL_ANALYSIS'
  | 'CHAT';

export type AIProvider =
  | 'GOOGLE'
  | 'ANTHROPIC'
  | 'OPENAI'
  | 'XAI';

export interface AIRequest {
  taskType: TaskType;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  userId?: string;
  sessionId?: string;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  modelString: string;
  versionLabel: string;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  isFreeTier: boolean;
  durationMs: number;
}

export interface TokenStats {
  provider: AIProvider;
  modelString: string;
  versionLabel: string;
  mode: 'FREE_TIER' | 'PAID';
  requestsToday: number;
  requestsLimit: number | null;
  tokensSession: number;
  tokensInputTotal: number;
  tokensOutputTotal: number;
  costUsd: number;
  costThisMonth: number;
  monthlyLimit: number;
  alertAtPct: number;
  limitReached: boolean;
}
