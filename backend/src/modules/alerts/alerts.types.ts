import { Alert } from './entities/alert.entity';

export enum AlertType {
  PRICE_ABOVE = 'PRICE_ABOVE',
  PRICE_BELOW = 'PRICE_BELOW',
  SCORE_ABOVE = 'SCORE_ABOVE',
  SENTIMENT_CHANGE = 'SENTIMENT_CHANGE',
  PORTFOLIO_PNL = 'PORTFOLIO_PNL',
  TOKEN_LIMIT = 'TOKEN_LIMIT',
  MARKET_OPEN = 'MARKET_OPEN',
  CUSTOM = 'CUSTOM',
}

export enum NotificationChannel {
  TELEGRAM = 'TELEGRAM',
  EMAIL = 'EMAIL',
  IN_APP = 'IN_APP',
  ALL = 'ALL',
}

export interface AlertTriggerContext {
  alertId: string;
  userId: string;
  type: AlertType;
  symbol?: string;
  market?: string;
  threshold: number;
  currentValue: number;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPayload {
  title: string;
  message: string;
  emoji: string;
  metadata?: Record<string, unknown>;
}

export interface AlertEvaluationResult {
  shouldFire: boolean;
  currentValue: number;
}

export interface NotificationSummary {
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface PaginatedNotifications<T> {
  data: T[];
  total: number;
  unread: number;
  page: number;
  limit: number;
}

export type AlertWithChannels = Pick<
  Alert,
  'id' | 'userId' | 'type' | 'name' | 'symbol' | 'market' | 'threshold' | 'channel' | 'telegramChatId' | 'emailAddress'
>;
