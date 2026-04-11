import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';

import { RedisPriceService } from '../cache/redis-price.service';
import { MacroData } from '../ar-market/ar-market.types';
import { DolarService } from '../ar-market/dolar.service';

interface BcraApiResponse {
  results?: Array<{
    fecha?: string;
    valor?: number;
  }>;
}

@Injectable()
export class MacroArService implements OnModuleInit {
  private readonly logger = new Logger(MacroArService.name);
  private readonly ttlSeconds = 24 * 60 * 60;
  private readonly bcraAxios: AxiosInstance;

  constructor(
    private readonly httpService: HttpService,
    private readonly redisPriceService: RedisPriceService,
    private readonly dolarService: DolarService,
  ) {
    this.bcraAxios = axios.create({
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10_000,
    });
  }

  onModuleInit(): void {
    void this.fetchMacroData();
  }

  @Cron('0 9 * * *')
  async refreshMacroData(): Promise<void> {
    await this.fetchMacroData();
  }

  async fetchMacroData(): Promise<MacroData> {
    const today = new Date();
    const thirtyDaysAgo = this.formatDate(this.addDays(today, -30));
    const fourHundredDaysAgo = this.formatDate(this.addDays(today, -400));
    const todayString = this.formatDate(today);
    const cached = await this.readCachedMacroData();

    try {
      const [dolarData, tasaPolitica, inflacionMensualSeries, inflacionAnualValue, reservasUsd] = await Promise.all([
        this.dolarService.getDolarData(),
        this.fetchLatestBcraValue(6, thirtyDaysAgo, todayString),
        this.fetchBcraSeries(27, fourHundredDaysAgo, todayString),
        this.fetchLatestBcraValue(28, fourHundredDaysAgo, todayString).catch(() => null),
        this.fetchLatestBcraValue(1, thirtyDaysAgo, todayString),
      ]);

      const inflacionMensual = inflacionMensualSeries.at(-1)?.valor ?? null;
      const inflacionAnual = inflacionAnualValue ?? this.sumLastInflationMonths(inflacionMensualSeries, 12);
      const macro: MacroData = {
        tcOficial: dolarData.oficial,
        tasaPolitica,
        inflacionMensual,
        inflacionAnual,
        reservasUsd,
        lastUpdated: new Date(),
      };

      await this.persistMacroData(macro);
      return macro;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`BCRA API fallo, se usan datos cacheados si existen: ${message}`);
      return cached;
    }
  }

  async getMacroData(): Promise<MacroData> {
    const cached = await this.readCachedMacroData();
    if (
      cached.tcOficial !== null ||
      cached.tasaPolitica !== null ||
      cached.inflacionMensual !== null ||
      cached.inflacionAnual !== null ||
      cached.reservasUsd !== null
    ) {
      return cached;
    }

    return this.fetchMacroData();
  }

  async getTcOficial(): Promise<number | null> {
    return (await this.getMacroData()).tcOficial;
  }

  async getTasaPolitica(): Promise<number | null> {
    return (await this.getMacroData()).tasaPolitica;
  }

  async getDolarMep(): Promise<number | null> {
    return (await this.dolarService.getDolarData()).mep;
  }

  async getMacroContext(): Promise<string> {
    const [macro, dolar] = await Promise.all([this.getMacroData(), this.dolarService.getDolarData()]);

    return `Contexto macro AR: TC oficial $${this.formatValue(macro.tcOficial)}, MEP $${this.formatValue(dolar.mep)}, Inflacion mensual ${this.formatValue(macro.inflacionMensual)}%, Tasa politica ${this.formatValue(macro.tasaPolitica)}%, Reservas $${this.formatValue(macro.reservasUsd)} millones USD`;
  }

  private async fetchBcraSeries(variableId: number, from: string, to: string): Promise<Array<{ fecha?: string; valor?: number }>> {
    const url = `https://api.bcra.gob.ar/estadisticas/v2.0/datosvariable/${variableId}/${from}/${to}`;
    this.logger.log(`Consultando BCRA: ${url}`);

    try {
      const response = await this.bcraAxios.get<BcraApiResponse>(url);
      return response.data.results ?? [];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Error BCRA en ${url}: ${message}`);
      throw error;
    }
  }

  private async fetchLatestBcraValue(variableId: number, from: string, to: string): Promise<number | null> {
    const series = await this.fetchBcraSeries(variableId, from, to);
    const latest = series.at(-1);
    return typeof latest?.valor === 'number' ? latest.valor : null;
  }

  private sumLastInflationMonths(series: Array<{ fecha?: string; valor?: number }>, months: number): number | null {
    const values = series
      .map((item) => item.valor)
      .filter((value): value is number => typeof value === 'number')
      .slice(-months);

    if (values.length === 0) {
      return null;
    }

    return Number(values.reduce((sum, value) => sum + value, 0).toFixed(2));
  }

  private async persistMacroData(data: MacroData): Promise<void> {
    await Promise.all([
      this.redisPriceService.setRawValue('macro:ar:tasa_politica', this.toRedisValue(data.tasaPolitica), this.ttlSeconds),
      this.redisPriceService.setRawValue('macro:ar:inflacion_mensual', this.toRedisValue(data.inflacionMensual), this.ttlSeconds),
      this.redisPriceService.setRawValue('macro:ar:inflacion_anual', this.toRedisValue(data.inflacionAnual), this.ttlSeconds),
      this.redisPriceService.setRawValue('macro:ar:reservas', this.toRedisValue(data.reservasUsd), this.ttlSeconds),
      this.redisPriceService.setRawValue('macro:ar:macro_last_updated', data.lastUpdated.toISOString(), this.ttlSeconds),
    ]);
  }

  private async readCachedMacroData(): Promise<MacroData> {
    const [dolarData, tasaPolitica, inflacionMensual, inflacionAnual, reservasUsd, lastUpdated] = await Promise.all([
      this.dolarService.getDolarData().catch(() => ({ oficial: null, mep: null, ccl: null, cripto: null, blue: null, lastUpdated: new Date() })),
      this.redisPriceService.getRawValue('macro:ar:tasa_politica'),
      this.redisPriceService.getRawValue('macro:ar:inflacion_mensual'),
      this.redisPriceService.getRawValue('macro:ar:inflacion_anual'),
      this.redisPriceService.getRawValue('macro:ar:reservas'),
      this.redisPriceService.getRawValue('macro:ar:macro_last_updated'),
    ]);

    return {
      tcOficial: dolarData.oficial,
      tasaPolitica: this.parseNullableNumber(tasaPolitica),
      inflacionMensual: this.parseNullableNumber(inflacionMensual),
      inflacionAnual: this.parseNullableNumber(inflacionAnual),
      reservasUsd: this.parseNullableNumber(reservasUsd),
      lastUpdated: lastUpdated ? new Date(lastUpdated) : new Date(),
    };
  }

  private toRedisValue(value: number | null): string {
    return value === null ? 'null' : value.toString();
  }

  private parseNullableNumber(value: string | null): number | null {
    if (!value || value === 'null') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private addDays(value: Date, days: number): Date {
    const copy = new Date(value);
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
  }

  private formatValue(value: number | null): string {
    return value === null ? 'N/D' : value.toFixed(2);
  }
}