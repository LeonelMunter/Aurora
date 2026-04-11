import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import { AIRequest, AIResponse } from '../dto/ai-router.types';

@Injectable()
export class OpenAIProvider {
  constructor(private readonly configService: ConfigService) {}

  async call(request: AIRequest, modelString: string): Promise<AIResponse> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY') ?? this.configService.get<string>('openai.apiKey');

    if (!apiKey) {
      throw new BadRequestException(
        'OpenAI API key no configurada. Agregala en /configuracion para usar modelos GPT.',
      );
    }

    const openai = new OpenAI({ apiKey });
    const startTime = Date.now();

    try {
      const response = await openai.chat.completions.create({
        model: modelString,
        messages: [
          { role: 'system', content: request.systemPrompt || '' },
          { role: 'user', content: request.prompt },
        ],
        max_tokens: request.maxTokens || 1024,
      });

      const tokensInput = response.usage?.prompt_tokens ?? 0;
      const tokensOutput = response.usage?.completion_tokens ?? 0;

      return {
        content: response.choices[0]?.message?.content ?? '',
        provider: 'OPENAI',
        modelString,
        versionLabel: this.toVersionLabel(modelString),
        tokensInput,
        tokensOutput,
        costUsd: this.calculateCost(modelString, tokensInput, tokensOutput),
        isFreeTier: false,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      throw new ServiceUnavailableException(`OpenAI no esta disponible en este momento: ${message}`);
    }
  }

  private calculateCost(modelString: string, input: number, output: number): number {
    if (modelString === 'gpt-5-nano') {
      return Number(((input * 0.05) / 1_000_000 + (output * 0.4) / 1_000_000).toFixed(6));
    }

    if (modelString === 'gpt-5-mini') {
      return Number(((input * 0.25) / 1_000_000 + (output * 2.0) / 1_000_000).toFixed(6));
    }

    return 0;
  }

  private toVersionLabel(modelString: string): string {
    switch (modelString) {
      case 'gpt-5-nano':
        return 'GPT-5 Nano';
      case 'gpt-5-mini':
        return 'GPT-5 Mini';
      default:
        return modelString;
    }
  }
}
