import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { AssetMarket } from '../../../shared/enums';
import { DolarData } from '../../ingestion/ar-market/ar-market.types';
import { DolarService } from '../../ingestion/ar-market/dolar.service';
import { RedisPriceService } from '../../ingestion/cache/redis-price.service';
import { StocksArService } from '../../ingestion/stocks/stocks-ar.service';
import { Asset } from '../entities/asset.entity';

interface CachedPrices {
  expiresAt: number;
  prices: Map<string, number | null>;
}

interface CoinGeckoPriceResponse {
  [key: string]: {
    usd?: number;
  };
}

@Injectable()
export class PriceProviderService {
  private readonly logger = new Logger(PriceProviderService.name);
  private readonly cacheTtlMs = 60_000;
  private readonly symbolToCoingeckoId = new Map<string, string>([
    ['BTC', 'bitcoin'],
    ['ETH', 'ethereum'],
    ['SOL', 'solana'],
    ['ADA', 'cardano'],
    ['BNB', 'binancecoin'],
    ['USDT', 'tether'],
    ['USDC', 'usd-coin'],
    ['DOT', 'polkadot'],
    ['MATIC', 'matic-network'],
  ]);
  private cache = new Map<string, CachedPrices>();

  constructor(
    private readonly httpService: HttpService,
    private readonly redisPriceService: RedisPriceService,
    private readonly dolarService: DolarService,
    private readonly stocksArService: StocksArService,
  ) {}

  async getPrices(assets: Asset[]): Promise<Map<string, number | null>> {
    const prices = new Map<string, number | null>();
    const dolarData = await this.dolarService.getDolarData();

    for (const asset of assets) {
      prices.set(asset.id, null);
    }

    await Promise.all(
      assets.map(async (asset) => {
        switch (asset.market) {
          case AssetMarket.STOCK_AR: {
            const entry = await this.redisPriceService.getPriceEntry(asset.symbol, AssetMarket.STOCK_AR);
            const priceUsd = entry ? this.convertArAssetToUsd(asset.symbol, entry.price, dolarData) : null;
            prices.set(asset.id, priceUsd);
            break;
          }
          case AssetMarket.BOND: {
            const entry = await this.redisPriceService.getPriceEntry(asset.symbol, AssetMarket.BOND);
            const rate = dolarData.mep ?? dolarData.oficial;
            const priceUsd = entry && rate ? Number((entry.price / rate).toFixed(4)) : null;
            prices.set(asset.id, priceUsd);
            break;
          }
          case AssetMarket.FX: {
            prices.set(asset.id, dolarData.mep ?? null);
            break;
          }
          default:
            break;
        }
      }),
    );

    const cryptoLikeAssets = assets.filter((asset) => asset.market === AssetMarket.CRYPTO || asset.market === AssetMarket.STAKING);
    const redisPrices = await Promise.all(
      cryptoLikeAssets.map(async (asset) => ({
        assetId: asset.id,
        price: await this.redisPriceService.getPrice(asset.symbol, AssetMarket.CRYPTO),
      })),
    );

    for (const entry of redisPrices) {
      if (entry.price !== null) {
        prices.set(entry.assetId, entry.price);
      }
    }

    const missingCryptoAssets = cryptoLikeAssets.filter((asset) => prices.get(asset.id) === null);
    if (missingCryptoAssets.length === 0) {
      return prices;
    }

    const cachedKeys = missingCryptoAssets
      .map((asset) => this.resolveCoinGeckoId(asset))
      .filter((id): id is string => Boolean(id))
      .sort();
    const cacheKey = cachedKeys.join(',');

    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return this.mergeFetchedPrices(prices, missingCryptoAssets, cached.prices);
      }
    }

    const cryptoIds = new Map<string, string>();

    for (const asset of missingCryptoAssets) {
      const coingeckoId = this.resolveCoinGeckoId(asset);
      if (coingeckoId) {
        cryptoIds.set(asset.id, coingeckoId);
      }
    }

    if (cryptoIds.size === 0) {
      return prices;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<CoinGeckoPriceResponse>('https://api.coingecko.com/api/v3/simple/price', {
          params: {
            ids: Array.from(new Set(cryptoIds.values())).join(','),
            vs_currencies: 'usd',
          },
        }),
      );

      const fetchedPrices = new Map<string, number | null>();

      for (const asset of missingCryptoAssets) {
        const coingeckoId = cryptoIds.get(asset.id);
        fetchedPrices.set(asset.id, coingeckoId ? response.data[coingeckoId]?.usd ?? null : null);
      }

      if (cacheKey) {
        this.cache.set(cacheKey, {
          expiresAt: Date.now() + this.cacheTtlMs,
          prices: new Map(fetchedPrices),
        });
      }

      return this.mergeFetchedPrices(prices, missingCryptoAssets, fetchedPrices);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`No se pudieron obtener precios desde CoinGecko: ${message}`);
      return prices;
    }
  }

  private resolveCoinGeckoId(asset: Asset): string | null {
    if (!(asset.market === AssetMarket.CRYPTO || asset.market === AssetMarket.STAKING)) {
      return null;
    }

    return asset.coingeckoId ?? this.symbolToCoingeckoId.get(asset.symbol.toUpperCase()) ?? null;
  }

  private convertArAssetToUsd(symbol: string, amountArs: number, dolarData: DolarData): number | null {
    const isCedear = this.stocksArService.isCedearSymbol(symbol);
    const rate = isCedear ? dolarData.ccl : (dolarData.mep ?? dolarData.oficial);

    if (rate === null || rate === 0) {
      return null;
    }

    return Number((amountArs / rate).toFixed(4));
  }

  private mergeFetchedPrices(
    prices: Map<string, number | null>,
    assets: Asset[],
    fetchedPrices: Map<string, number | null>,
  ): Map<string, number | null> {
    for (const asset of assets) {
      prices.set(asset.id, fetchedPrices.get(asset.id) ?? prices.get(asset.id) ?? null);
    }

    return prices;
  }
}