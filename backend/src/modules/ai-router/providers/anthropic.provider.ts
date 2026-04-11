import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

import { AIRequest, AIResponse } from '../dto/ai-router.types';

@Injectable()
export class AnthropicProvider {
  constructor(private readonly configService: ConfigService) {}

  async call(request: AIRequest, modelString: string): Promise<AIResponse> {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY') ?? this.configService.get<string>('anthropic.apiKey');

    if (!apiKey) {
      throw new BadRequestException(
        'Anthropic API key no configurada. Agregala en /configuracion para usar modelos Claude.',
      );
    }

    const anthropic = new Anthropic({ apiKey });
    const startTime = Date.now();

    try {
      const response = await anthropic.messages.create({
        model: modelString,
        max_tokens: request.maxTokens || 1024,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.prompt }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const tokensInput = response.usage.input_tokens;
      const tokensOutput = response.usage.output_tokens;

      return {
        content: textContent?.type === 'text' ? textContent.text : '',
        provider: 'ANTHROPIC',
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
      throw new ServiceUnavailableException(`Claude no esta disponible en este momento: ${message}`);
    }
  }

  private calculateCost(modelString: string, input: number, output: number): number {
    if (modelString === 'claude-haiku-4-5') {
      return Number(((input * 0.25) / 1_000_000 + (output * 1.25) / 1_000_000).toFixed(6));
    }

    if (modelString === 'claude-sonnet-4-6') {
      return Number(((input * 3.0) / 1_000_000 + (output * 15.0) / 1_000_000).toFixed(6));
    }

    return 0;
  }

  private toVersionLabel(modelString: string): string {
    switch (modelString) {
      case 'claude-haiku-4-5':
        return 'Claude Haiku 4.5';
      case 'claude-sonnet-4-6':
        return 'Claude Sonnet 4.6';
      default:
        return modelString;
    }
  }
}
