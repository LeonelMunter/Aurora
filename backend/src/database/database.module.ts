import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import { User } from '../auth/entities/user.entity';
import { AiLimit } from '../modules/ai-router/entities/ai-limit.entity';
import { AiModel } from '../modules/ai-router/entities/ai-model.entity';
import { AiUsageLog } from '../modules/ai-router/entities/ai-usage-log.entity';
import { Alert } from '../modules/alerts/entities/alert.entity';
import { Notification } from '../modules/alerts/entities/notification.entity';
import { MarketPrice } from '../modules/ingestion/entities/market-price.entity';
import { PriceCandle } from '../modules/ingestion/entities/price-candle.entity';
import { Asset } from '../modules/portfolio/entities/asset.entity';
import { Import } from '../modules/portfolio/entities/import.entity';
import { Portfolio } from '../modules/portfolio/entities/portfolio.entity';
import { Transaction } from '../modules/portfolio/entities/transaction.entity';
import { WealthSnapshotEntity } from '../modules/portfolio/entities/wealth-snapshot.entity';
import { NewsItem } from '../modules/sentiment/entities/news-item.entity';
import { SentimentScore } from '../modules/sentiment/entities/sentiment-score.entity';
import { EmergingAsset } from '../modules/suggestions/entities/emerging-asset.entity';
import { SuggestionChat } from '../modules/suggestions/entities/suggestion-chat.entity';
import { Suggestion } from '../modules/suggestions/entities/suggestion.entity';

function buildDatabaseUrl(config: ConfigService): string {
  const databaseUrl = config.get<string>('DATABASE_URL') ?? config.get<string>('database.url');

  if (databaseUrl) {
    return databaseUrl;
  }

  const user = config.get<string>('DB_USER') ?? config.get<string>('database.user');
  const password = config.get<string>('DB_PASSWORD') ?? config.get<string>('database.password');
  const name = config.get<string>('DB_NAME') ?? config.get<string>('database.name');

  if (!user || !password || !name) {
    throw new Error(
      'No se pudo resolver la conexion a PostgreSQL. Defini DATABASE_URL o completa DB_USER, DB_PASSWORD y DB_NAME en backend/.env.',
    );
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost:5432/${name}`;
}

export function createDatabaseConfig(config: ConfigService): TypeOrmModuleOptions {
  const url = buildDatabaseUrl(config);
  const isDevelopment =
    (config.get<string>('NODE_ENV') ?? config.get<string>('app.nodeEnv') ?? 'development') ===
    'development';

  return {
    type: 'postgres',
    url,
    entities: [
      User,
      Portfolio,
      Transaction,
      Asset,
      Import,
      WealthSnapshotEntity,
      PriceCandle,
      MarketPrice,
      AiModel,
      AiUsageLog,
      AiLimit,
      NewsItem,
      SentimentScore,
      Suggestion,
      EmergingAsset,
      SuggestionChat,
      __dirname + '/../**/*.entity{.ts,.js}',
    ],
    synchronize: isDevelopment,
    logging: isDevelopment,
  };
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        try {
          return createDatabaseConfig(config);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          throw new Error(`Error al inicializar PostgreSQL: ${message}`);
        }
      },
    }),
  ],
})
export class DatabaseModule {}
