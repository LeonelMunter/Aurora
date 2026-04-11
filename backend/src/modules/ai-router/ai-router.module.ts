import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { GatewayModule } from '../gateway/gateway.module';
import { AiRouterController } from './ai-router.controller';
import { AiRouterService } from './ai-router.service';
import { seedAIModels } from './ai-models.seed';
import { AiLimit } from './entities/ai-limit.entity';
import { AiModel } from './entities/ai-model.entity';
import { AiUsageLog } from './entities/ai-usage-log.entity';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { TokenCounterService } from './token-counter.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiModel, AiUsageLog, AiLimit]), HttpModule, GatewayModule],
  providers: [
    AiRouterService,
    TokenCounterService,
    GeminiProvider,
    AnthropicProvider,
    OpenAIProvider,
  ],
  controllers: [AiRouterController],
  exports: [AiRouterService, TokenCounterService],
})
export class AiRouterModule implements OnModuleInit {
  private readonly logger = new Logger(AiRouterModule.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY') ?? this.configService.get<string>('gemini.apiKey');

    if (!geminiApiKey) {
      this.logger.warn(
        '? GEMINI_API_KEY no configurada. El AI Router no funcionará hasta configurarla. Obtené tu key gratis en aistudio.google.com',
      );
    }

    await seedAIModels(this.dataSource);
  }
}
