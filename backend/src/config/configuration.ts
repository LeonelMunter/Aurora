export interface AppConfiguration {
  database: {
    url: string | undefined;
    user: string;
    password: string;
    name: string;
  };
  redis: {
    url: string;
  };
  jwt: {
    secret: string;
    refreshSecret: string;
  };
  gemini: {
    apiKey: string;
  };
  anthropic: {
    apiKey: string;
  };
  openai: {
    apiKey: string;
  };
  xai: {
    apiKey: string;
  };
  binance: {
    wsUrl: string;
  };
  coingecko: {
    apiUrl: string;
  };
  telegram: {
    botToken: string;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  app: {
    port: number;
    nodeEnv: string;
  };
}

const configuration = (): AppConfiguration => ({
  database: {
    url: process.env.DATABASE_URL,
    user: process.env.DB_USER ?? '',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? '',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
  },
  xai: {
    apiKey: process.env.XAI_API_KEY ?? '',
  },
  binance: {
    wsUrl: process.env.BINANCE_WS_URL ?? '',
  },
  coingecko: {
    apiUrl: process.env.COINGECKO_API_URL ?? '',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  },
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },
  app: {
    port: Number(process.env.PORT ?? 3000),
    nodeEnv: process.env.NODE_ENV ?? 'development',
  },
});

export default configuration;
