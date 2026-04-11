import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { AssetMarket } from '../../shared/enums';
import { isCedearSymbol } from '../ingestion/ar-market/ar-market.constants';
import { DolarService } from '../ingestion/ar-market/dolar.service';
import { YahooFinanceService } from '../ingestion/ar-market/yahoo-finance.service';
import { CryptoIngestionService } from '../ingestion/crypto/crypto-ingestion.service';
import { PriceCandle } from '../ingestion/entities/price-candle.entity';
import {
  DailyPortfolioValue,
  GridOrder,
  SimulatorCandle,
  SimulatorConfig,
  SimulatorResult,
  SimStrategy,
  TradeResult,
} from './simulator.types';

@Injectable()
export class BacktestEngineService {
  constructor(
    @InjectRepository(PriceCandle)
    private readonly priceCandleRepository: Repository<PriceCandle>,
    private readonly cryptoIngestionService: CryptoIngestionService,
    private readonly yahooFinanceService: YahooFinanceService,
    private readonly dolarService: DolarService,
  ) {}

  async getHistoricalCandles(
    symbol: string,
    market: AssetMarket,
    startDate: string,
    endDate: string,
  ): Promise<SimulatorCandle[]> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const start = new Date(startDate);
    const end = new Date(endDate);
    const requestedDays = Math.max(30, Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 30);

    let candles = await this.loadCandles(normalizedSymbol, market, start, end);

    if (candles.length < 10) {
      try {
        if (market === AssetMarket.CRYPTO) {
          await this.cryptoIngestionService.fetchHistoricalCandles(normalizedSymbol, '1d', Math.max(requestedDays, 365));
        }

        if (market === AssetMarket.STOCK_AR || market === AssetMarket.BOND) {
          await this.yahooFinanceService.fetchHistoricalAR(normalizedSymbol, Math.max(requestedDays, 365), market);
        }
      } catch {
      }

      candles = await this.loadCandles(normalizedSymbol, market, start, end);
    }

    if (candles.length < 10) {
      if (market === AssetMarket.STOCK_AR || market === AssetMarket.BOND) {
        throw new BadRequestException(
          `No hay datos históricos para ${normalizedSymbol}. El historial de activos argentinos se acumula con el tiempo de uso de la app.`,
        );
      }

      throw new BadRequestException(`No hay suficientes datos históricos para ${normalizedSymbol}. Necesitamos mínimo 10 días.`);
    }

    return this.normalizeCandlesForSimulation(normalizedSymbol, market, candles);
  }


  private async normalizeCandlesForSimulation(
    symbol: string,
    market: AssetMarket,
    candles: SimulatorCandle[],
  ): Promise<SimulatorCandle[]> {
    if (candles.length === 0) {
      return candles;
    }

    if (market === AssetMarket.CRYPTO || (market === AssetMarket.STOCK_AR && isCedearSymbol(symbol))) {
      return candles;
    }

    if (market !== AssetMarket.STOCK_AR && market !== AssetMarket.BOND) {
      return candles;
    }

    const dolar = await this.dolarService.getDolarData().catch(() => null);
    const rate = dolar?.mep ?? dolar?.oficial ?? null;

    if (rate === null || rate <= 0) {
      return candles;
    }

    return candles.map((candle) => ({
      ...candle,
      open: Number((candle.open / rate).toFixed(6)),
      high: Number((candle.high / rate).toFixed(6)),
      low: Number((candle.low / rate).toFixed(6)),
      close: Number((candle.close / rate).toFixed(6)),
    }));
  }
  private async loadCandles(symbol: string, market: AssetMarket, start: Date, end: Date): Promise<SimulatorCandle[]> {
    const candles = await this.priceCandleRepository.find({
      where: {
        symbol,
        market,
        interval: '1d',
        openTime: Between(start, end),
      },
      order: { openTime: 'ASC' },
    });

    return candles.map((candle) => ({
      time: Math.floor(candle.openTime.getTime() / 1000),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.volume),
    }));
  }

  private buildPoint(candle: SimulatorCandle, portfolioValue: number, capitalInvested: number, ordersExecuted = 0): DailyPortfolioValue {
    const pnlUsd = portfolioValue - capitalInvested;
    return {
      date: new Date(candle.time * 1000).toISOString().split('T')[0],
      portfolioValue,
      capitalInvested,
      pnlUsd,
      pnlPct: capitalInvested === 0 ? 0 : (pnlUsd / capitalInvested) * 100,
      price: candle.close,
      ordersExecuted,
    };
  }

  private simulateHolding(candles: SimulatorCandle[], config: SimulatorConfig): SimulatorResult {
    const entryPrice = config.holdingParams?.entryPrice ?? candles[0].close;
    const quantity = config.capital / entryPrice;
    const portfolioHistory = candles.map((candle) => this.buildPoint(candle, quantity * candle.close, config.capital));
    const finalValue = quantity * candles[candles.length - 1].close;
    const totalPnlUsd = finalValue - config.capital;
    const totalPnlPct = (totalPnlUsd / config.capital) * 100;

    return this.finalizeResult({
      config,
      strategy: 'HOLDING',
      symbol: config.symbol,
      startDate: config.startDate,
      endDate: config.endDate,
      durationDays: candles.length,
      initialCapital: config.capital,
      finalValue,
      totalPnlUsd,
      totalPnlPct,
      annualizedReturn: this.calculateAnnualizedReturn(totalPnlPct, candles.length),
      maxDrawdown: this.calculateMaxDrawdown(portfolioHistory),
      sharpeRatio: this.calculateSharpe(portfolioHistory),
      winRate: 0,
      totalTrades: 0,
      totalFees: 0,
      portfolioHistory,
      priceHistory: candles,
    }, candles);
  }

  private simulateGridBot(candles: SimulatorCandle[], config: SimulatorConfig): SimulatorResult {
    const gridParams = config.gridParams!;
    const rangeMin = gridParams.useAutoRange ? Math.min(...candles.map((c) => c.low)) * 0.98 : gridParams.rangeMin;
    const rangeMax = gridParams.useAutoRange ? Math.max(...candles.map((c) => c.high)) * 1.02 : gridParams.rangeMax;
    const gridCount = gridParams.gridCount;
    const step = (rangeMax - rangeMin) / gridCount;
    const levels = Array.from({ length: gridCount + 1 }, (_, index) => rangeMin + step * index);
    const capitalPerGrid = config.capital / Math.max(gridCount, 1);

    let cash = config.capital;
    let quantity = 0;
    let totalFees = 0;
    let executedOrders = 0;
    const gridOrders: GridOrder[] = [];
    const openBuys: Array<{ price: number; quantity: number }> = [];

    const portfolioHistory: DailyPortfolioValue[] = [];

    for (const candle of candles) {
      for (const level of levels) {
        if (candle.low <= level && level <= candle.high) {
          const existing = openBuys.find((item) => Math.abs(item.price - level) < 0.0001);
          if (!existing && cash >= capitalPerGrid) {
            const fee = capitalPerGrid * 0.001;
            const qty = (capitalPerGrid - fee) / level;
            cash -= capitalPerGrid;
            quantity += qty;
            totalFees += fee;
            executedOrders += 1;
            openBuys.push({ price: level, quantity: qty });
            gridOrders.push({ price: level, type: 'BUY', executedAt: candle.time, quantity: qty, profit: 0 });
            continue;
          }

          const buyIndex = openBuys.findIndex((item) => Math.abs(item.price - (level - step)) < 0.0001);
          if (buyIndex >= 0 && candle.high >= level) {
            const matched = openBuys[buyIndex];
            const gross = matched.quantity * level;
            const fee = gross * 0.001;
            cash += gross - fee;
            quantity -= matched.quantity;
            totalFees += fee;
            executedOrders += 1;
            gridOrders.push({ price: level, type: 'SELL', executedAt: candle.time, quantity: matched.quantity, profit: (level - matched.price) * matched.quantity - fee });
            openBuys.splice(buyIndex, 1);
          }
        }
      }

      portfolioHistory.push(this.buildPoint(candle, cash + quantity * candle.close, config.capital, executedOrders));
    }

    const finalValue = cash + quantity * candles[candles.length - 1].close;
    const totalPnlUsd = finalValue - config.capital;
    const totalPnlPct = (totalPnlUsd / config.capital) * 100;
    const sellOrders = gridOrders.filter((order) => order.type === 'SELL' && order.profit > 0).length;
    const winRate = gridOrders.length === 0 ? 0 : (sellOrders / Math.max(gridOrders.filter((order) => order.type === 'SELL').length, 1)) * 100;

    return this.finalizeResult({
      config,
      strategy: 'GRID_BOT',
      symbol: config.symbol,
      startDate: config.startDate,
      endDate: config.endDate,
      durationDays: candles.length,
      initialCapital: config.capital,
      finalValue,
      totalPnlUsd,
      totalPnlPct,
      annualizedReturn: this.calculateAnnualizedReturn(totalPnlPct, candles.length),
      maxDrawdown: this.calculateMaxDrawdown(portfolioHistory),
      sharpeRatio: this.calculateSharpe(portfolioHistory),
      winRate,
      totalTrades: executedOrders,
      totalFees,
      portfolioHistory,
      gridOrders,
      priceHistory: candles,
    }, candles);
  }

  private simulateDCA(candles: SimulatorCandle[], config: SimulatorConfig): SimulatorResult {
    const dcaParams = config.dcaParams!;
    let totalInvested = 0;
    let quantity = 0;
    const dcaBuys: SimulatorResult['dcaBuys'] = [];
    const portfolioHistory: DailyPortfolioValue[] = [];

    candles.forEach((candle, index) => {
      if (index === 0 || index % Math.max(dcaParams.intervalDays, 1) === 0) {
        const amount = Math.min(dcaParams.amountPerBuy, config.capital - totalInvested);
        if (amount > 0) {
          const bought = amount / candle.close;
          quantity += bought;
          totalInvested += amount;
          dcaBuys.push({
            date: new Date(candle.time * 1000).toISOString().split('T')[0],
            price: candle.close,
            quantity: bought,
            totalInvested,
          });
        }
      }

      const value = quantity * candle.close + (config.capital - totalInvested);
      portfolioHistory.push(this.buildPoint(candle, value, config.capital, dcaBuys.length));
    });

    const finalValue = quantity * candles[candles.length - 1].close + (config.capital - totalInvested);
    const totalPnlUsd = finalValue - config.capital;
    const totalPnlPct = (totalPnlUsd / config.capital) * 100;
    const profitableBuys = dcaBuys.filter((buy) => candles[candles.length - 1].close > buy.price).length;

    return this.finalizeResult({
      config,
      strategy: 'DCA',
      symbol: config.symbol,
      startDate: config.startDate,
      endDate: config.endDate,
      durationDays: candles.length,
      initialCapital: config.capital,
      finalValue,
      totalPnlUsd,
      totalPnlPct,
      annualizedReturn: this.calculateAnnualizedReturn(totalPnlPct, candles.length),
      maxDrawdown: this.calculateMaxDrawdown(portfolioHistory),
      sharpeRatio: this.calculateSharpe(portfolioHistory),
      winRate: dcaBuys.length === 0 ? 0 : (profitableBuys / dcaBuys.length) * 100,
      totalTrades: dcaBuys.length,
      totalFees: dcaBuys.length * dcaParams.amountPerBuy * 0.001,
      portfolioHistory,
      dcaBuys,
      priceHistory: candles,
    }, candles);
  }

  private simulateLeveragedTrade(candles: SimulatorCandle[], config: SimulatorConfig, side: 'LONG' | 'SHORT'): SimulatorResult {
    const tradeParams = config.tradeParams!;
    const leverage = Math.max(1, tradeParams.leverage ?? 1);
    const entryPrice = tradeParams.entryPrice;
    const targetPrice = tradeParams.targetPrice;
    const stopLoss = tradeParams.stopLoss;
    const marginRequired = config.capital / leverage;
    const liquidationPrice = side === 'LONG'
      ? entryPrice * (1 - 1 / leverage)
      : entryPrice * (1 + 1 / leverage);
    const effectiveCapital = config.capital * leverage;
    const quantity = effectiveCapital / entryPrice;

    let exitPrice: number | null = null;
    let exitDate: string | null = null;
    let result: TradeResult['result'] = 'OPEN';
    let liquidationDate: string | null = null;
    let wasLiquidated = false;

    const portfolioHistory: DailyPortfolioValue[] = [];

    for (const candle of candles) {
      if (!exitPrice) {
        if (side === 'LONG' && leverage > 1 && candle.low <= liquidationPrice) {
          exitPrice = liquidationPrice;
          exitDate = new Date(candle.time * 1000).toISOString().split('T')[0];
          liquidationDate = exitDate;
          result = 'LIQUIDATED';
          wasLiquidated = true;
        } else if (side === 'SHORT' && leverage > 1 && candle.high >= liquidationPrice) {
          exitPrice = liquidationPrice;
          exitDate = new Date(candle.time * 1000).toISOString().split('T')[0];
          liquidationDate = exitDate;
          result = 'LIQUIDATED';
          wasLiquidated = true;
        } else if (side === 'LONG' && candle.high >= targetPrice) {
          exitPrice = targetPrice;
          exitDate = new Date(candle.time * 1000).toISOString().split('T')[0];
          result = 'TARGET_HIT';
        } else if (side === 'LONG' && candle.low <= stopLoss) {
          exitPrice = stopLoss;
          exitDate = new Date(candle.time * 1000).toISOString().split('T')[0];
          result = 'STOP_HIT';
        } else if (side === 'SHORT' && candle.low <= targetPrice) {
          exitPrice = targetPrice;
          exitDate = new Date(candle.time * 1000).toISOString().split('T')[0];
          result = 'TARGET_HIT';
        } else if (side === 'SHORT' && candle.high >= stopLoss) {
          exitPrice = stopLoss;
          exitDate = new Date(candle.time * 1000).toISOString().split('T')[0];
          result = 'STOP_HIT';
        }
      }

      const markPrice = exitPrice ?? candle.close;
      let pnlUsd = 0;
      if (wasLiquidated) {
        pnlUsd = -config.capital;
      } else if (side === 'LONG') {
        pnlUsd = ((markPrice - entryPrice) / entryPrice) * config.capital * leverage;
      } else {
        pnlUsd = ((entryPrice - markPrice) / entryPrice) * config.capital * leverage;
      }
      pnlUsd = Math.max(-config.capital, pnlUsd);

      portfolioHistory.push({
        date: new Date(candle.time * 1000).toISOString().split('T')[0],
        portfolioValue: config.capital + pnlUsd,
        capitalInvested: config.capital,
        pnlUsd,
        pnlPct: (pnlUsd / config.capital) * 100,
        price: candle.close,
        ordersExecuted: exitPrice ? 1 : 0,
      });

      if (exitPrice) {
        continue;
      }
    }

    const finalPnlUsd = wasLiquidated
      ? -config.capital
      : side === 'LONG'
        ? (((exitPrice ?? candles[candles.length - 1].close) - entryPrice) / entryPrice) * config.capital * leverage
        : ((entryPrice - (exitPrice ?? candles[candles.length - 1].close)) / entryPrice) * config.capital * leverage;
    const boundedPnl = Math.max(-config.capital, finalPnlUsd);
    const finalValue = config.capital + boundedPnl;
    const totalPnlPct = (boundedPnl / config.capital) * 100;

    return this.finalizeResult({
      config: {
        ...config,
        tradeParams: {
          ...tradeParams,
          leverage,
          liquidationPrice,
          marginRequired,
        },
      },
      strategy: side,
      symbol: config.symbol,
      startDate: config.startDate,
      endDate: config.endDate,
      durationDays: candles.length,
      initialCapital: config.capital,
      finalValue,
      totalPnlUsd: boundedPnl,
      totalPnlPct,
      annualizedReturn: this.calculateAnnualizedReturn(totalPnlPct, candles.length),
      maxDrawdown: this.calculateMaxDrawdown(portfolioHistory),
      sharpeRatio: this.calculateSharpe(portfolioHistory),
      winRate: result === 'TARGET_HIT' ? 100 : result === 'OPEN' ? 50 : 0,
      totalTrades: 1,
      totalFees: effectiveCapital * 0.002,
      portfolioHistory,
      tradeResult: {
        entryDate: new Date(candles[0].time * 1000).toISOString().split('T')[0],
        exitDate,
        exitPrice,
        result,
        leverageUsed: leverage,
        liquidationPrice,
        marginRequired,
        wasLiquidated,
        liquidationDate,
      },
      priceHistory: candles,
    }, candles);
  }

  private simulateStaking(candles: SimulatorCandle[], config: SimulatorConfig): SimulatorResult {
    const apy = config.stakingParams?.apyPct ?? 0;
    const dailyRate = apy / 365 / 100;
    let value = config.capital;
    const portfolioHistory = candles.map((candle) => {
      value *= 1 + dailyRate;
      return this.buildPoint(candle, value, config.capital);
    });

    const finalValue = portfolioHistory[portfolioHistory.length - 1].portfolioValue;
    const totalPnlUsd = finalValue - config.capital;
    const totalPnlPct = (totalPnlUsd / config.capital) * 100;

    return this.finalizeResult({
      config,
      strategy: 'STAKING',
      symbol: config.symbol,
      startDate: config.startDate,
      endDate: config.endDate,
      durationDays: candles.length,
      initialCapital: config.capital,
      finalValue,
      totalPnlUsd,
      totalPnlPct,
      annualizedReturn: this.calculateAnnualizedReturn(totalPnlPct, candles.length),
      maxDrawdown: this.calculateMaxDrawdown(portfolioHistory),
      sharpeRatio: this.calculateSharpe(portfolioHistory),
      winRate: 100,
      totalTrades: 0,
      totalFees: 0,
      portfolioHistory,
      priceHistory: candles,
    }, candles);
  }

  private finalizeResult(result: SimulatorResult, candles: SimulatorCandle[]): SimulatorResult {
    this.addHoldingComparison(result, candles);
    return result;
  }

  private calculateAnnualizedReturn(totalPnlPct: number, durationDays: number): number {
    if (durationDays <= 0) return 0;
    const yearsElapsed = durationDays / 365;
    if (yearsElapsed <= 0) return 0;
    const annualized = Math.pow(1 + totalPnlPct / 100, 1 / yearsElapsed) - 1;
    return Number((annualized * 100).toFixed(2));
  }

  private calculateSharpe(history: DailyPortfolioValue[]): number {
    if (history.length < 2) return 0;
    const returns = history.slice(1).map((point, index) => {
      const prev = history[index].portfolioValue;
      return prev === 0 ? 0 : (point.portfolioValue - prev) / prev;
    });
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return 0;
    return Number(Math.max(0, (mean / stdDev) * Math.sqrt(252)).toFixed(2));
  }

  private calculateMaxDrawdown(history: DailyPortfolioValue[]): number {
    if (history.length === 0) return 0;
    let peak = history[0].portfolioValue;
    let maxDrawdown = 0;
    for (const point of history) {
      if (point.portfolioValue > peak) {
        peak = point.portfolioValue;
      }
      const drawdown = peak === 0 ? 0 : ((peak - point.portfolioValue) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    return Number(maxDrawdown.toFixed(2));
  }

  private addHoldingComparison(result: SimulatorResult, candles: SimulatorCandle[]): void {
    const entry = candles[0].close;
    const exit = candles[candles.length - 1].close;
    const quantity = result.initialCapital / entry;
    const finalValue = quantity * exit;
    const pnlPct = ((finalValue - result.initialCapital) / result.initialCapital) * 100;
    result.holdingComparison = {
      finalValue,
      pnlPct,
      betterThan: result.totalPnlPct > pnlPct,
    };
  }

  async run(config: SimulatorConfig): Promise<SimulatorResult> {
    const startDate = new Date(config.startDate);
    const endDate = new Date(config.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException('La fecha final debe ser posterior a la inicial.');
    }

    if ((endDate.getTime() - startDate.getTime()) / 86_400_000 > 730) {
      throw new BadRequestException('El período máximo es de 2 años (730 días).');
    }

    const candles = await this.getHistoricalCandles(config.symbol, config.market, config.startDate, config.endDate);

    let result: SimulatorResult;
    switch (config.strategy) {
      case 'HOLDING':
        result = this.simulateHolding(candles, config);
        break;
      case 'GRID_BOT':
        if (!config.gridParams) throw new BadRequestException('gridParams es requerido para GRID_BOT.');
        result = this.simulateGridBot(candles, config);
        break;
      case 'DCA':
        if (!config.dcaParams) throw new BadRequestException('dcaParams es requerido para DCA.');
        result = this.simulateDCA(candles, config);
        break;
      case 'LONG':
        if (!config.tradeParams) throw new BadRequestException('tradeParams es requerido para LONG.');
        result = this.simulateLeveragedTrade(candles, config, 'LONG');
        break;
      case 'SHORT':
        if (!config.tradeParams) throw new BadRequestException('tradeParams es requerido para SHORT.');
        result = this.simulateLeveragedTrade(candles, config, 'SHORT');
        break;
      case 'STAKING':
        if (!config.stakingParams) throw new BadRequestException('stakingParams es requerido para STAKING.');
        result = this.simulateStaking(candles, config);
        break;
      default:
        throw new BadRequestException(`Estrategia no reconocida: ${config.strategy as SimStrategy}`);
    }

    return result;
  }
}




