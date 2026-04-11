import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { FearGreedData } from '../sentiment.types';

interface FearGreedApiResponse {
  data?: Array<{
    value?: string;
    value_classification?: string;
    timestamp?: string;
  }>;
}

@Injectable()
export class FearGreedSource {
  private readonly logger = new Logger(FearGreedSource.name);

  constructor(private readonly httpService: HttpService) {}

  async fetchFearGreed(): Promise<FearGreedData | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<FearGreedApiResponse>('https://api.alternative.me/fng/', {
          params: { limit: 1 },
          timeout: 10_000,
        }),
      );

      const entry = response.data.data?.[0];
      if (!entry?.value) {
        return null;
      }

      return {
        value: Number(entry.value),
        classification: entry.value_classification ?? 'Unknown',
        timestamp: new Date(Number(entry.timestamp ?? Math.floor(Date.now() / 1000)) * 1000),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`No se pudo obtener Fear & Greed: ${message}`);
      return null;
    }
  }

  convertToScore(fearGreedValue: number): number {
    return fearGreedValue;
  }
}