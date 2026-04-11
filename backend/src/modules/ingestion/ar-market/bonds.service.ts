import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { AssetMarket } from '../../../shared/enums';
import { RedisPriceService } from '../cache/redis-price.service';
import { MarketPrice } from '../entities/market-price.entity';
import {
  BOND_DEFINITIONS,
  BYMA_DELAY_NOTE,
  BondDefinition,
  getBondDefinition,
  isArMarketOpen,
} from './ar-market.constants';
import { BondPrice } from './ar-market.types';
import { DolarService } from './dolar.service';

interface QuoteSnapshot {
  symbol: string;
  name: string;
  price: number;
  change24h: number | null;
  volume: number | null;
  lastUpdated: Date;
}

interface BondReferenceFallback {
  priceArs: number | null;
  priceUsd: number | null;
  currency: 'ARS' | 'USD';
}

const BOND_SYMBOL_VARIANTS: Record<string, string[]> = {
  AL30: ['AL30', 'AL30-24H'],
  GD30: ['GD30', 'GD30-24H'],
  AY24: ['AY24', 'AY24D'],
};

const BOND_REFERENCE_FALLBACKS: Record<string, BondReferenceFallback> = {
  AL30: { priceArs: 5500, priceUsd: 55.0, currency: 'ARS' },
  GD30: { priceArs: null, priceUsd: 68.0, currency: 'USD' },
  AY24: { priceArs: 9800, priceUsd: null, currency: 'ARS' },
  GD35: { priceArs: null, priceUsd: 72.0, currency: 'USD' },
  AL35: { priceArs: 4200, priceUsd: 42.0, currency: 'ARS' },
};

@Injectable()
export class BondsService implements OnModuleInit {
  private readonly logger = new Logger(BondsService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly redisPriceService: RedisPriceService,
    private readonly dolarService: DolarService,
    @InjectRepository(MarketPrice)
    private readonly marketPriceRepository: Repository<MarketPrice>,
  ) {}

  onModuleInit(): void {
    void this.fetchBondPrices();
  }

  @Cron('0 * * * * *')
  async refreshBondPrices(): Promise<void> {
    if (!isArMarketOpen()) {
      return;
    }

    await this.fetchBondPrices();
    await this.calculateMEP();
  }

  async fetchBondPrices(): Promise<BondPrice[]> {
    const results = await Promise.allSettled(
      BOND_DEFINITIONS.map((bond, index) => this.withDelay(index * 500, () => this.fetchBondPriceWithFallbacks(bond))),
    );

    const fulfilled = results
      .filter((result): result is PromiseFulfilledResult<BondPrice | null> => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter((value): value is BondPrice => value !== null);

    if (fulfilled.length > 0) {
      await this.calculateMEP();
    }

    return fulfilled;
  }

  async calculateMEP(): Promise<number | null> {
    const [al30, al30d] = await Promise.all([
      this.redisPriceService.getPriceEntry('AL30', AssetMarket.BOND),
      this.redisPriceService.getPriceEntry('AL30D', AssetMarket.BOND),
    ]);

    if (!al30 || !al30d || al30.price === 0) {
      return null;
    }

    const mep = Number(((al30d.price / al30.price) * 100).toFixed(2));
    await this.redisPriceService.setRawValue('macro:ar:dolar_mep_bonos', mep.toString(), 5 * 60);
    return mep;
  }

  async getBondPrice(symbol: string): Promise<BondPrice | null> {
    const normalized = symbol.trim().toUpperCase();
    const definition = getBondDefinition(normalized);
    if (!definition) {
      return null;
    }

    const cached = await this.getCachedBondPrice(definition);
    if (cached) {
      return cached;
    }

    return this.fetchBondPriceWithFallbacks(definition);
  }

  private async fetchBondPriceWithFallbacks(definition: BondDefinition): Promise<BondPrice | null> {
    const fromRava = await this.fetchFromRava(definition);
    if (fromRava) {
      return fromRava;
    }

    const fromAmbito = await this.fetchFromAmbito(definition);
    if (fromAmbito) {
      return fromAmbito;
    }

    const fromReference = await this.fetchFromReferenceFallback(definition);
    if (fromReference) {
      return fromReference;
    }

    return this.getCachedBondPrice(definition);
  }

  private async fetchFromRava(definition: BondDefinition): Promise<BondPrice | null> {
    try {
      const variants = BOND_SYMBOL_VARIANTS[definition.symbol] ?? [definition.symbol];
      let arsQuote: QuoteSnapshot | null = null;

      for (const variant of variants) {
        arsQuote = await this.fetchRavaQuote(variant);
        if (arsQuote) {
          break;
        }
      }

      if (!arsQuote) {
        return null;
      }

      const usdSymbol = `${definition.symbol}D`;
      const usdQuote = definition.currency === 'USD' ? await this.fetchRavaQuote(usdSymbol) : null;
      const officialUsd = arsQuote.price ? await this.dolarService.convertArsToUsd(arsQuote.price) : null;
      const bondPrice: BondPrice = {
        symbol: definition.symbol,
        name: definition.name || arsQuote.name,
        priceArs: arsQuote.price,
        priceUsd: usdQuote?.price ?? officialUsd,
        couponRate: definition.couponRate,
        maturityDate: definition.maturityDate ? new Date(definition.maturityDate) : null,
        currency: definition.currency,
        lastUpdated: arsQuote.lastUpdated,
        source: 'RAVA',
        note: 'Precios con delay de 20 min (BYMA)',
      };

      await this.persistBondPrice(definition, bondPrice, arsQuote.change24h, arsQuote.volume, 'RAVA');
      if (usdQuote) {
        await this.redisPriceService.setPrice(usdSymbol, AssetMarket.BOND, usdQuote.price, 60, usdQuote.change24h ?? null);
      }

      return bondPrice;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`Rava fallo para bono ${definition.symbol}: ${message}`);
      return null;
    }
  }

  private async fetchFromAmbito(definition: BondDefinition): Promise<BondPrice | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<unknown>(`https://mercados.ambito.com/bonos/${definition.symbol}/variacion`, {
          timeout: 10_000,
        }),
      );

      const payload = response.data;
      if (!Array.isArray(payload) || payload.length === 0) {
        return null;
      }

      const priceArs = this.toNumber(payload[0]);
      const change24h = payload.length > 1 ? this.toNumber(payload[1]) : null;
      if (priceArs === null) {
        return null;
      }

      const priceUsd = definition.currency === 'USD'
        ? Number((priceArs / 100).toFixed(2))
        : await this.dolarService.convertArsToUsd(priceArs);

      const bondPrice: BondPrice = {
        symbol: definition.symbol,
        name: definition.name,
        priceArs,
        priceUsd,
        couponRate: definition.couponRate,
        maturityDate: definition.maturityDate ? new Date(definition.maturityDate) : null,
        currency: definition.currency,
        lastUpdated: new Date(),
        source: 'AMBITO',
        note: 'Precios de Ambito Mercados',
      };

      await this.persistBondPrice(definition, bondPrice, change24h, null, null);
      return bondPrice;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`Ambito fallo para bono ${definition.symbol}: ${message}`);
      return null;
    }
  }

  private async fetchFromReferenceFallback(definition: BondDefinition): Promise<BondPrice | null> {
    const fallback = BOND_REFERENCE_FALLBACKS[definition.symbol];
    if (!fallback) {
      return null;
    }

    const bondPrice: BondPrice = {
      symbol: definition.symbol,
      name: definition.name,
      priceArs: fallback.priceArs,
      priceUsd: fallback.priceUsd,
      couponRate: definition.couponRate,
      maturityDate: definition.maturityDate ? new Date(definition.maturityDate) : null,
      currency: fallback.currency,
      lastUpdated: new Date(),
      source: 'FALLBACK',
      note: 'Precio de referencia - actualizar manualmente',
    };

    await this.persistBondPrice(definition, bondPrice, null, null, null);
    return bondPrice;
  }

  private async persistBondPrice(
    definition: BondDefinition,
    bondPrice: BondPrice,
    change24h: number | null,
    volume24h: number | null,
    source: 'RAVA' | null,
  ): Promise<void> {
    if (bondPrice.priceArs !== null) {
      await this.redisPriceService.setPrice(definition.symbol, AssetMarket.BOND, bondPrice.priceArs, 60, change24h ?? null);
    }

    await this.marketPriceRepository.upsert(
      {
        symbol: definition.symbol,
        market: AssetMarket.BOND,
        priceUsd: bondPrice.priceUsd,
        priceArs: bondPrice.priceArs,
        currency: bondPrice.currency,
        tcOficial: (await this.dolarService.getDolarData()).oficial,
        change24h,
        volume24h,
        high24h: null,
        low24h: null,
        marketCap: null,
        source,
        exchange: 'BYMA',
        lastUpdated: bondPrice.lastUpdated,
      },
      ['symbol', 'market'],
    );
  }

  private async getCachedBondPrice(definition: BondDefinition): Promise<BondPrice | null> {
    const [cached, dbPrice] = await Promise.all([
      this.redisPriceService.getPriceEntry(definition.symbol, AssetMarket.BOND),
      this.marketPriceRepository.findOne({ where: { symbol: definition.symbol, market: AssetMarket.BOND } }),
    ]);

    if (!cached && !dbPrice) {
      return null;
    }

    return {
      symbol: definition.symbol,
      name: definition.name,
      priceArs: cached?.price ?? dbPrice?.priceArs ?? null,
      priceUsd: dbPrice?.priceUsd ?? null,
      couponRate: definition.couponRate,
      maturityDate: definition.maturityDate ? new Date(definition.maturityDate) : null,
      currency: definition.currency,
      lastUpdated: cached ? new Date(cached.timestamp) : dbPrice?.lastUpdated ?? new Date(),
      source: dbPrice?.source === 'RAVA' ? 'RAVA' : undefined,
      note: BYMA_DELAY_NOTE,
    };
  }

  private async fetchRavaQuote(symbol: string): Promise<QuoteSnapshot | null> {
    const response = await firstValueFrom(
      this.httpService.get<unknown>('https://www.rava.com/empresas/cotizacion.php', {
        params: {
          fmt: 'json',
          prod: symbol,
        },
        timeout: 10_000,
      }),
    );

    return this.extractQuote(symbol, response.data);
  }

  private extractQuote(symbol: string, payload: unknown): QuoteSnapshot | null {
    const candidate = this.findQuoteCandidate(payload);
    if (!candidate) {
      return null;
    }

    const price = this.toNumber(candidate['ultimo'] ?? candidate['ultimoPrecio'] ?? candidate['precio'] ?? candidate['cierre']);
    if (price === null) {
      return null;
    }

    return {
      symbol,
      name: this.toStringValue(candidate['descripcion'] ?? candidate['nombre'] ?? candidate['especie']) ?? symbol,
      price,
      change24h: this.toNumber(candidate['variacion'] ?? candidate['variacionPorcentual']),
      volume: this.toNumber(candidate['volumen'] ?? candidate['montoOperado']),
      lastUpdated: new Date(),
    };
  }

  private findQuoteCandidate(payload: unknown): Record<string, unknown> | null {
    if (Array.isArray(payload)) {
      for (const item of payload) {
        const found = this.findQuoteCandidate(item);
        if (found) {
          return found;
        }
      }

      return null;
    }

    if (typeof payload !== 'object' || payload === null) {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.some((key) => ['ultimo', 'ultimoPrecio', 'precio', 'cierre'].includes(key))) {
      return record;
    }

    for (const value of Object.values(record)) {
      const found = this.findQuoteCandidate(value);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toStringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private async withDelay<T>(delayMs: number, task: () => Promise<T>): Promise<T> {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return task();
  }
}