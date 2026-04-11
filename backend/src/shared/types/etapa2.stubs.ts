// OMS - Order Management System (Etapa 2)
export interface PlaceOrderDto {
  assetId: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  type: 'MARKET' | 'LIMIT';
}

export interface OrderResult {
  orderId: string;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  filledAt?: Date;
}

// Risk Manager (Etapa 2)
export interface RiskConfig {
  maxCapitalPerTrade: number;
  maxDailyLoss: number;
  circuitBreakerThreshold: number;
}

export interface RiskCheckResult {
  approved: boolean;
  reason?: string;
}

// Exchange Connector (Etapa 2)
export interface ExchangeCredentials {
  exchange: string;
  apiKey: string;
  apiSecret: string;
}

export interface TradeExecution {
  execute(order: PlaceOrderDto, credentials: ExchangeCredentials): Promise<OrderResult>;
}
