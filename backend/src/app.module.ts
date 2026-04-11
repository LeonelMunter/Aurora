import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import * as Joi from 'joi';

import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AiRouterModule } from './modules/ai-router/ai-router.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { SentimentModule } from './modules/sentiment/sentiment.module';
import { StrategyModule } from './modules/strategy/strategy.module';
import { SuggestionsModule } from './modules/suggestions/suggestions.module';
import { SimulatorModule } from './modules/simulator/simulator.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).optional(),
        DB_USER: Joi.string().when('DATABASE_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        DB_PASSWORD: Joi.string().when('DATABASE_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        DB_NAME: Joi.string().when('DATABASE_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        REDIS_URL: Joi.string().uri({ scheme: ['redis'] }).required(),
        JWT_SECRET: Joi.string().min(16).required(),
        JWT_REFRESH_SECRET: Joi.string().min(16).required(),
        GEMINI_API_KEY: Joi.string().required(),
        ANTHROPIC_API_KEY: Joi.string().allow('').optional(),
        OPENAI_API_KEY: Joi.string().allow('').optional(),
        XAI_API_KEY: Joi.string().allow('').optional(),
        BINANCE_WS_URL: Joi.string().uri({ scheme: ['ws', 'wss'] }).required(),
        COINGECKO_API_URL: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
        LUNARCRUSH_API_KEY: Joi.string().allow('').optional(),
        WHALE_ALERT_API_KEY: Joi.string().allow('').optional(),
        TELEGRAM_BOT_TOKEN: Joi.string().allow('').optional(),
        SMTP_HOST: Joi.string().allow('').optional(),
        SMTP_PORT: Joi.number().port().optional(),
        SMTP_USER: Joi.string().allow('').optional(),
        SMTP_PASS: Joi.string().allow('').optional(),
        PORT: Joi.number().port().default(3001),
        NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
      }),
    }),
    DatabaseModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = new URL(configService.getOrThrow<string>('redis.url'));

        return {
          redis: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
            password: redisUrl.password || undefined,
            db: redisUrl.pathname ? Number(redisUrl.pathname.replace('/', '') || 0) : 0,
          },
        };
      },
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    PortfolioModule,
    IngestionModule,
    AnalysisModule,
    StrategyModule,
    SentimentModule,
    AiRouterModule,
    AlertsModule,
    GatewayModule,
    SuggestionsModule,
    SimulatorModule,
  ],
})
export class AppModule {}
