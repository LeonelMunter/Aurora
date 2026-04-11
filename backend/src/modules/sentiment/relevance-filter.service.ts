import { Injectable, Logger } from '@nestjs/common';

import { AiRouterService } from '../ai-router/ai-router.service';
import { ALL_RELEVANCE_KEYWORDS, WATCHLIST_SYMBOLS } from './sentiment.constants';
import { RawNewsItem } from './sentiment.types';

@Injectable()
export class RelevanceFilterService {
  private readonly logger = new Logger(RelevanceFilterService.name);

  constructor(private readonly aiRouterService: AiRouterService) {}

  filterByKeywords(items: RawNewsItem[]): RawNewsItem[] {
    return items.filter((item) => {
      const title = this.normalizeText(item.title);
      return ALL_RELEVANCE_KEYWORDS.some((keyword) => title.includes(this.normalizeText(keyword)));
    });
  }

  extractSymbols(text: string): string[] {
    const normalized = this.normalizeText(text);
    const symbols = WATCHLIST_SYMBOLS
      .filter((entry) => entry.keywords.some((keyword) => normalized.includes(this.normalizeText(keyword))))
      .map((entry) => entry.symbol);

    return Array.from(new Set(symbols));
  }

  async filterWithAI(items: RawNewsItem[], batchSize = 10): Promise<RawNewsItem[]> {
    const relevant: RawNewsItem[] = [];

    for (let index = 0; index < items.length; index += batchSize) {
      const batch = items.slice(index, index + batchSize);

      try {
        const prompt = [
          'Sos un filtro de relevancia financiera.',
          'Analiza estos titulos de noticias y responde SOLO con un JSON array de indices (0-based)',
          'de las noticias relevantes para cripto o mercado financiero argentino.',
          'Ejemplo respuesta: [0, 2, 4]',
          '',
          'Titulos:',
          ...batch.map((item, itemIndex) => `${itemIndex}. ${item.title}`),
        ].join('\n');

        const response = await this.aiRouterService.analyze(prompt, 'FILTER_RELEVANCE');
        const parsed = this.parseIndexes(response.content, batch.length);
        relevant.push(...parsed.map((itemIndex) => batch[itemIndex]));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        this.logger.warn(`Fallback por keywords en relevance filter: ${message}`);
        relevant.push(...this.filterByKeywords(batch));
      }
    }

    return relevant;
  }

  private parseIndexes(content: string, batchLength: number): number[] {
    const normalized = this.extractJsonSegment(content);
    const parsed = JSON.parse(normalized) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error('La IA no devolvio un array JSON.');
    }

    return Array.from(
      new Set(
        parsed.filter(
          (value): value is number =>
            typeof value === 'number' &&
            Number.isInteger(value) &&
            value >= 0 &&
            value < batchLength,
        ),
      ),
    );
  }

  private extractJsonSegment(content: string): string {
    const trimmed = content.trim();
    const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

    if (codeBlock?.[1]) {
      return codeBlock[1].trim();
    }

    const start = trimmed.indexOf('[');
    const end = trimmed.lastIndexOf(']');

    if (start >= 0 && end > start) {
      return trimmed.slice(start, end + 1);
    }

    return trimmed;
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}