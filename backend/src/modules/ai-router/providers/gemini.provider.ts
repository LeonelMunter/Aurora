import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { AIRequest, AIResponse } from '../dto/ai-router.types';

@Injectable()
export class GeminiProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly models = {
    'gemini-2.5-flash-lite': { rpm: 15, rpd: 1000 },
    'gemini-2.5-flash': { rpm: 10, rpd: 250 },
    'gemini-2.5-pro': { rpm: 5, rpd: 100 },
  } satisfies Record<string, { rpm: number; rpd: number }>;

  constructor(private readonly configService: ConfigService) {}

  async call(request: AIRequest, modelString: string): Promise<AIResponse> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') ?? this.configService.get<string>('gemini.apiKey');

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY no configurada. El AI Router no funcionara hasta configurarla.',
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelString,
      systemInstruction: request.systemPrompt,
    });

    const startTime = Date.now();

    try {
      const response = await model.generateContent(request.prompt);
      const usage = response.response.usageMetadata;

      return {
        content: response.response.text(),
        provider: 'GOOGLE',
        modelString,
        versionLabel: this.toVersionLabel(modelString),
        tokensInput: usage?.promptTokenCount ?? 0,
        tokensOutput: usage?.candidatesTokenCount ?? 0,
        costUsd: 0,
        isFreeTier: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Gemini fallo para ${modelString}: ${message}`);

      if (message.includes('429')) {
        throw new HttpException('Gemini alcanzo su limite de uso temporal. Reintentaremos con otro modelo.', HttpStatus.TOO_MANY_REQUESTS);
      }

      throw new ServiceUnavailableException('Gemini no esta disponible en este momento.');
    }
  }

  private toVersionLabel(modelString: string): string {
    switch (modelString) {
      case 'gemini-2.5-flash-lite':
        return 'Gemini 2.5 Flash-Lite';
      case 'gemini-2.5-flash':
        return 'Gemini 2.5 Flash';
      case 'gemini-2.5-pro':
        return 'Gemini 2.5 Pro';
      default:
        return modelString;
    }
  }
}
