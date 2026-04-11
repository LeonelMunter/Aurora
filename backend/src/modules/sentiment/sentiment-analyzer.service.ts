import { Injectable, Logger } from '@nestjs/common';

import { AiRouterService } from '../ai-router/ai-router.service';
import { NewsItem, NewsSentiment, SentimentIntensity } from './entities/news-item.entity';
import { RelevanceFilterService } from './relevance-filter.service';
import { RawNewsItem } from './sentiment.types';

interface AIAnalysisPayload {
  sentiment?: string;
  score?: number;
  intensity?: string;
  symbols?: string[];
  summary?: string;
}

@Injectable()
export class SentimentAnalyzerService {
  private readonly logger = new Logger(SentimentAnalyzerService.name);

  constructor(
    private readonly aiRouterService: AiRouterService,
    private readonly relevanceFilterService: RelevanceFilterService,
  ) {}

  async analyzeSentiment(item: RawNewsItem): Promise<Partial<NewsItem>> {
    const prompt = [
      'Analiza el sentimiento de esta noticia financiera y responde SOLO con JSON valido, sin texto adicional:',
      '{',
      '  "sentiment": "POSITIVE"|"NEGATIVE"|"NEUTRAL",',
      '  "score": numero entre 0 y 100,',
      '  "intensity": "HIGH"|"MEDIUM"|"LOW",',
      '  "symbols": ["BTC","ETH"],',
      '  "summary": "resumen en una oracion"',
      '}',
      '',
      `Noticia: ${item.title} - ${item.summary}`,
    ].join('\n');

    try {
      const response = await this.aiRouterService.analyze(prompt, 'SENTIMENT_NEWS');
      const parsed = this.parsePayload(response.content);
      const fallbackSymbols = this.relevanceFilterService.extractSymbols(`${item.title} ${item.summary}`);

      return {
        sentiment: this.normalizeSentiment(parsed.sentiment),
        sentimentScore: this.clampScore(parsed.score),
        intensity: this.normalizeIntensity(parsed.intensity),
        symbols: this.normalizeSymbols(parsed.symbols, fallbackSymbols),
        aiSummary:
          typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
            ? parsed.summary.trim()
            : item.summary.slice(0, 280),
        processedAt: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`Fallback neutral en analisis de sentimiento: ${message}`);

      return {
        sentiment: NewsSentiment.NEUTRAL,
        sentimentScore: 50,
        intensity: SentimentIntensity.LOW,
        symbols: this.relevanceFilterService.extractSymbols(`${item.title} ${item.summary}`),
        aiSummary: item.summary.slice(0, 280),
        processedAt: new Date(),
      };
    }
  }

  async analyzeBatch(items: RawNewsItem[], delay = 2000): Promise<Array<Partial<NewsItem>>> {
    const results: Array<Partial<NewsItem>> = [];

    for (let index = 0; index < items.length; index += 1) {
      results.push(await this.analyzeSentiment(items[index]));

      if (index < items.length - 1) {
        await this.wait(delay);
      }
    }

    return results;
  }

  private parsePayload(content: string): AIAnalysisPayload {
    const payload = JSON.parse(this.extractJsonSegment(content)) as unknown;

    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new Error('La respuesta de IA no es un objeto JSON valido.');
    }

    return payload as AIAnalysisPayload;
  }

  private extractJsonSegment(content: string): string {
    const trimmed = content.trim();
    const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

    if (codeBlock?.[1]) {
      return codeBlock[1].trim();
    }

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');

    if (start >= 0 && end > start) {
      return trimmed.slice(start, end + 1);
    }

    return trimmed;
  }

  private normalizeSentiment(value: string | undefined): NewsSentiment {
    switch (value) {
      case NewsSentiment.POSITIVE:
        return NewsSentiment.POSITIVE;
      case NewsSentiment.NEGATIVE:
        return NewsSentiment.NEGATIVE;
      default:
        return NewsSentiment.NEUTRAL;
    }
  }

  private normalizeIntensity(value: string | undefined): SentimentIntensity {
    switch (value) {
      case SentimentIntensity.HIGH:
        return SentimentIntensity.HIGH;
      case SentimentIntensity.MEDIUM:
        return SentimentIntensity.MEDIUM;
      default:
        return SentimentIntensity.LOW;
    }
  }

  private normalizeSymbols(value: string[] | undefined, fallback: string[]): string[] {
    const normalized = Array.isArray(value)
      ? value
          .filter((symbol): symbol is string => typeof symbol === 'string' && symbol.trim().length > 0)
          .map((symbol) => symbol.trim().toUpperCase())
      : [];

    const merged = normalized.length > 0 ? normalized : fallback;
    return Array.from(new Set(merged));
  }

  private clampScore(value: number | undefined): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 50;
    }

    return Math.max(0, Math.min(100, Number(value.toFixed(2))));
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}