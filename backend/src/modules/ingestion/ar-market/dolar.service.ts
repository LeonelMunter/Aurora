import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';

import { RedisPriceService } from '../cache/redis-price.service';
import { DolarData } from './ar-market.types';

interface DolarApiItem {
  casa?: string;
  compra?: number;
  venta?: number;
}

@Injectable()
export class DolarService implements OnModuleInit {
  private readonly logger = new Logger(DolarService.name);
  private readonly ttlSeconds = 10 * 60;

  constructor(
    private readonly httpService: HttpService,
    private readonly redisPriceService: RedisPriceService,
  ) {}

  onModuleInit(): void {
    void this.fetchDolarData();
  }

  @Cron('0 */10 * * * *')
  async refreshDolarData(): Promise<void> {
    await this.fetchDolarData();
  }

  async fetchDolarData(): Promise<DolarData> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<DolarApiItem[]>('https://dolarapi.com/v1/dolares', { timeout: 10_000 }),
      );

      const data = this.mapDolarApiResponse(response.data);
      if (data.oficial === null) {
        throw new Error('DolarAPI no devolvio dolar oficial.');
      }

      await this.persistDolarData(data);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`DolarAPI fallo, se intenta fallback oficial: ${message}`);
    }

    try {
      const oficial = await this.fetchOfficialFromAmbito();
      const cached = await this.readCachedDolarData();
      const fallback: DolarData = {
        oficial,
        mep: cached.mep,
        ccl: cached.ccl,
        cripto: cached.cripto,
        blue: cached.blue,
        lastUpdated: new Date(),
      };
      await this.persistDolarData(fallback);
      return fallback;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Fallback de Ambito fallo: ${message}`);
    }

    const cached = await this.readCachedDolarData();
    if (cached.oficial !== null || cached.mep !== null || cached.ccl !== null || cached.cripto !== null || cached.blue !== null) {
      return cached;
    }

    this.logger.error('No hay datos de dolar disponibles ni en APIs ni en Redis.');
    return {
      oficial: null,
      mep: null,
      ccl: null,
      cripto: null,
      blue: null,
      lastUpdated: new Date(),
    };
  }

  async getDolarData(): Promise<DolarData> {
    const cached = await this.readCachedDolarData();
    if (cached.oficial !== null) {
      return cached;
    }

    return this.fetchDolarData();
  }

  async convertArsToUsd(amountArs: number): Promise<number | null> {
    const data = await this.getDolarData();
    if (data.oficial === null || data.oficial === 0) {
      return null;
    }

    return Number((amountArs / data.oficial).toFixed(4));
  }

  private mapDolarApiResponse(items: DolarApiItem[]): DolarData {
    const findValue = (house: string): number | null => {
      const entry = items.find((item) => item.casa?.toLowerCase() === house);
      return typeof entry?.venta === 'number' ? entry.venta : null;
    };

    return {
      oficial: findValue('oficial'),
      mep: findValue('bolsa'),
      ccl: findValue('contadoconliqui'),
      cripto: findValue('cripto'),
      blue: findValue('blue'),
      lastUpdated: new Date(),
    };
  }

  private async fetchOfficialFromAmbito(): Promise<number> {
    const response = await firstValueFrom(
      this.httpService.get<unknown>('https://mercados.ambito.com/dolar/oficial/variacion', {
        timeout: 10_000,
      }),
    );

    const value = this.extractNumericValue(response.data);
    if (value === null) {
      throw new Error('Ambito no devolvio un valor valido para dolar oficial.');
    }

    return value;
  }

  private async persistDolarData(data: DolarData): Promise<void> {
    const entries: Array<{ key: string; value: number | null }> = [
      { key: 'macro:ar:dolar_oficial', value: data.oficial },
      { key: 'macro:ar:dolar_mep', value: data.mep },
      { key: 'macro:ar:dolar_ccl', value: data.ccl },
      { key: 'macro:ar:dolar_cripto', value: data.cripto },
      { key: 'macro:ar:dolar_blue', value: data.blue },
    ];

    await Promise.all(
      entries.map(({ key, value }) => this.redisPriceService.setRawValue(key, value === null ? 'null' : value.toString(), this.ttlSeconds)),
    );
    await this.redisPriceService.setRawValue('macro:ar:dolar_last_updated', data.lastUpdated.toISOString(), this.ttlSeconds);
  }

  private async readCachedDolarData(): Promise<DolarData> {
    const [oficial, mep, ccl, cripto, blue, lastUpdated] = await Promise.all([
      this.redisPriceService.getRawValue('macro:ar:dolar_oficial'),
      this.redisPriceService.getRawValue('macro:ar:dolar_mep'),
      this.redisPriceService.getRawValue('macro:ar:dolar_ccl'),
      this.redisPriceService.getRawValue('macro:ar:dolar_cripto'),
      this.redisPriceService.getRawValue('macro:ar:dolar_blue'),
      this.redisPriceService.getRawValue('macro:ar:dolar_last_updated'),
    ]);

    return {
      oficial: this.parseNullableNumber(oficial),
      mep: this.parseNullableNumber(mep),
      ccl: this.parseNullableNumber(ccl),
      cripto: this.parseNullableNumber(cripto),
      blue: this.parseNullableNumber(blue),
      lastUpdated: lastUpdated ? new Date(lastUpdated) : new Date(),
    };
  }

  private extractNumericValue(payload: unknown): number | null {
    if (typeof payload === 'number') {
      return payload;
    }

    if (typeof payload === 'string') {
      return this.parseNullableNumber(payload);
    }

    if (Array.isArray(payload)) {
      for (const item of payload) {
        const value = this.extractNumericValue(item);
        if (value !== null) {
          return value;
        }
      }
    }

    if (typeof payload === 'object' && payload !== null) {
      for (const value of Object.values(payload)) {
        const numeric = this.extractNumericValue(value);
        if (numeric !== null) {
          return numeric;
        }
      }
    }

    return null;
  }

  private parseNullableNumber(value: string | null): number | null {
    if (!value || value === 'null') {
      return null;
    }

    const cleaned = value.trim().replace(/[^0-9,.-]/g, '');
    if (!cleaned) {
      return null;
    }

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    let normalized = cleaned;
    if (hasComma && hasDot) {
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      normalized = lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
    } else if (hasComma) {
      normalized = cleaned.replace(',', '.');
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
