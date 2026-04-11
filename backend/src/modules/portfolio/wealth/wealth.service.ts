import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, MoreThanOrEqual, Repository } from 'typeorm';

import { AssetMarket, TransactionType } from '../../../shared/enums';
import { Asset } from '../entities/asset.entity';
import { Portfolio } from '../entities/portfolio.entity';
import { Transaction } from '../entities/transaction.entity';
import { WealthSnapshotEntity } from '../entities/wealth-snapshot.entity';
import { PortfolioService } from '../portfolio.service';
import { PriceProviderService } from './price-provider.service';
import {
  AssetAllocation,
  MarketAllocation,
  PeriodComparison,
  RiskMetrics,
  StakingMetrics,
  WealthSnapshot,
  WealthSummary,
} from './wealth.types';

@Injectable()
export class WealthService {
  constructor(
    @InjectRepository(Portfolio)
    private readonly portfolioRepository: Repository<Portfolio>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(WealthSnapshotEntity)
    private readonly wealthSnapshotRepository: Repository<WealthSnapshotEntity>,
    private readonly portfolioService: PortfolioService,
    private readonly priceProvider: PriceProviderService,
  ) {}

  async getWealthSummary(userId: string, portfolioId: string): Promise<WealthSummary> {
    const portfolio = await this.getOwnedPortfolioOrFail(userId, portfolioId);
    const positions = await this.portfolioService.getPositions(userId, portfolioId);
    const prices = await this.priceProvider.getPrices(positions.map((position) => position.asset));

    const precomputedPositions = positions.map((position) => {
      const currentPrice = prices.get(position.asset.id) ?? null;
      const currentValue = currentPrice !== null ? this.roundMoney(position.quantity * currentPrice) : null;
      const pnlUsd = currentValue !== null ? this.roundMoney(currentValue - position.totalInvested) : null;
      const pnlPct =
        pnlUsd !== null && position.totalInvested > 0
          ? this.roundPct((pnlUsd / position.totalInvested) * 100)
          : null;

      return {
        position,
        currentPrice,
        currentValue,
        pnlUsd,
        pnlPct,
      };
    });

    const totalInvested = this.roundMoney(
      precomputedPositions.reduce((sum, item) => sum + item.position.totalInvested, 0),
    );
    const knownValues = precomputedPositions
      .map((item) => item.currentValue)
      .filter((value): value is number => value !== null);
    const totalValueUsd =
      knownValues.length > 0 ? this.roundMoney(knownValues.reduce((sum, value) => sum + value, 0)) : null;
    const totalPnlUsd = totalValueUsd !== null ? this.roundMoney(totalValueUsd - totalInvested) : null;
    const totalPnlPct =
      totalPnlUsd !== null && totalInvested > 0 ? this.roundPct((totalPnlUsd / totalInvested) * 100) : null;

    const calculatedPositions: AssetAllocation[] = precomputedPositions.map((item) => ({
      assetId: item.position.asset.id,
      symbol: item.position.asset.symbol,
      name: item.position.asset.name,
      market: item.position.asset.market,
      quantity: this.roundQuantity(item.position.quantity),
      avgCost: this.roundMoney(item.position.avgCost),
      currentPrice: item.currentPrice !== null ? this.roundMoney(item.currentPrice) : null,
      currentValue: item.currentValue,
      totalInvested: this.roundMoney(item.position.totalInvested),
      pnlUsd: item.pnlUsd,
      pnlPct: item.pnlPct,
      portfolioPct:
        item.currentValue !== null && totalValueUsd !== null && totalValueUsd > 0
          ? this.roundPct((item.currentValue / totalValueUsd) * 100)
          : null,
    }));

    const byMarket = this.calculateMarketAllocation(calculatedPositions, totalValueUsd);
    const today = new Date();
    const yesterdayDateString = this.toDateOnly(this.addDays(today, -1));

    await this.saveSnapshot(portfolioId, {
      totalValueUsd,
      totalInvested,
      totalPnlUsd,
      totalPnlPct,
    });

    const yesterdaySnapshot = await this.wealthSnapshotRepository.findOne({
      where: { portfolioId, date: yesterdayDateString },
    });
    const allTimeHighSnapshot = await this.wealthSnapshotRepository.findOne({
      where: {
        portfolioId,
        totalValueUsd: MoreThanOrEqual(0),
      },
      order: {
        totalValueUsd: 'DESC',
        date: 'ASC',
      },
    });

    const yesterdayValue = yesterdaySnapshot?.totalValueUsd ?? null;
    const dayChange =
      totalValueUsd !== null && yesterdayValue !== null ? this.roundMoney(totalValueUsd - yesterdayValue) : null;
    const dayChangePct =
      dayChange !== null && yesterdayValue !== null && yesterdayValue > 0
        ? this.roundPct((dayChange / yesterdayValue) * 100)
        : null;

    return {
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      totalValueUsd,
      totalInvested,
      totalPnlUsd,
      totalPnlPct,
      allTimeHigh: allTimeHighSnapshot?.totalValueUsd ?? totalValueUsd,
      allTimeHighDate: allTimeHighSnapshot
        ? this.fromDateOnly(allTimeHighSnapshot.date)
        : totalValueUsd !== null
          ? this.fromDateOnly(this.toDateOnly(today))
          : null,
      dayChange,
      dayChangePct,
      positions: calculatedPositions,
      byMarket,
      lastUpdated: today,
    };
  }

  async getHistoricalChart(
    userId: string,
    portfolioId: string,
    period: '7D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL',
  ): Promise<WealthSnapshot[]> {
    await this.getOwnedPortfolioOrFail(userId, portfolioId);

    const dateFrom = this.getDateFromPeriod(period);
    const where: FindOptionsWhere<WealthSnapshotEntity> = dateFrom
      ? { portfolioId, date: Between(this.toDateOnly(dateFrom), this.toDateOnly(new Date())) }
      : { portfolioId };

    const snapshots = await this.wealthSnapshotRepository.find({
      where,
      order: { date: 'ASC' },
    });

    return snapshots.map((snapshot) => ({
      date: this.fromDateOnly(snapshot.date),
      totalValueUsd: snapshot.totalValueUsd ?? 0,
      totalInvested: snapshot.totalInvested,
      pnlUsd: snapshot.pnlUsd ?? 0,
      pnlPct: snapshot.pnlPct ?? 0,
    }));
  }

  async getPeriodComparison(userId: string, portfolioId: string): Promise<PeriodComparison[]> {
    await this.getWealthSummary(userId, portfolioId);

    const snapshots = await this.wealthSnapshotRepository.find({
      where: { portfolioId },
      order: { date: 'ASC' },
    });

    if (snapshots.length === 0) {
      return [
        this.buildEmptyComparison('Este mes vs mes anterior'),
        this.buildEmptyComparison('Este trimestre vs trimestre anterior'),
        this.buildEmptyComparison('Este año vs año anterior'),
      ];
    }

    const latestSnapshot = snapshots[snapshots.length - 1];
    const now = new Date();
    const currentQuarter = Math.floor(now.getUTCMonth() / 3);

    return [
      this.createComparison(
        'Este mes vs mes anterior',
        snapshots,
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
        latestSnapshot,
      ),
      this.createComparison(
        'Este trimestre vs trimestre anterior',
        snapshots,
        new Date(Date.UTC(now.getUTCFullYear(), currentQuarter * 3 - 3, 1)),
        latestSnapshot,
      ),
      this.createComparison(
        'Este año vs año anterior',
        snapshots,
        new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)),
        latestSnapshot,
      ),
    ];
  }

  async getStakingMetrics(userId: string, portfolioId: string): Promise<StakingMetrics> {
    await this.getOwnedPortfolioOrFail(userId, portfolioId);

    const rewardTransactions = await this.transactionRepository.find({
      where: { portfolioId, type: TransactionType.REWARD },
      relations: { asset: true },
      order: { date: 'ASC' },
    });

    if (rewardTransactions.length === 0) {
      return {
        totalRewardsUsd: 0,
        rewardsByAsset: [],
        projectedAnnual: null,
        projectedMonthly: null,
      };
    }

    const prices = await this.priceProvider.getPrices(rewardTransactions.map((transaction) => transaction.asset));
    const rewardsByAssetMap = new Map<string, { symbol: string; quantity: number; estimatedUsd: number | null }>();

    for (const transaction of rewardTransactions) {
      const existing = rewardsByAssetMap.get(transaction.assetId) ?? {
        symbol: transaction.asset.symbol,
        quantity: 0,
        estimatedUsd: 0,
      };
      const currentPrice = prices.get(transaction.assetId) ?? null;

      existing.quantity += transaction.quantity;
      existing.estimatedUsd =
        currentPrice !== null ? this.roundMoney(existing.quantity * currentPrice) : null;
      rewardsByAssetMap.set(transaction.assetId, existing);
    }

    const rewardsByAsset = Array.from(rewardsByAssetMap.values()).map((reward) => ({
      symbol: reward.symbol,
      quantity: this.roundQuantity(reward.quantity),
      estimatedUsd: reward.estimatedUsd,
    }));

    const knownRewards = rewardsByAsset
      .map((reward) => reward.estimatedUsd)
      .filter((value): value is number => value !== null);
    const totalRewardsUsd = this.roundMoney(knownRewards.reduce((sum, value) => sum + value, 0));
    const firstRewardDate = rewardTransactions[0].date;
    const daysSinceFirstReward = Math.max(1, Math.ceil((Date.now() - firstRewardDate.getTime()) / 86_400_000));
    const rewardsPerDay = totalRewardsUsd > 0 ? totalRewardsUsd / daysSinceFirstReward : null;

    return {
      totalRewardsUsd,
      rewardsByAsset,
      projectedAnnual: rewardsPerDay !== null ? this.roundMoney(rewardsPerDay * 365) : null,
      projectedMonthly: rewardsPerDay !== null ? this.roundMoney(rewardsPerDay * 30) : null,
    };
  }

  async getRiskMetrics(userId: string, portfolioId: string): Promise<RiskMetrics> {
    const summary = await this.getWealthSummary(userId, portfolioId);
    const validPortfolioPcts = summary.positions
      .map((position) => position.portfolioPct)
      .filter((value): value is number => value !== null);

    const hhi = validPortfolioPcts.reduce((sum, value) => sum + (value / 100) ** 2, 0);
    const largestPosition = summary.positions.reduce<AssetAllocation | null>((largest, current) => {
      if (current.portfolioPct === null) {
        return largest;
      }

      if (!largest || (largest.portfolioPct ?? 0) < current.portfolioPct) {
        return current;
      }

      return largest;
    }, null);

    return {
      diversificationScore: this.roundPct(Math.max(0, (1 - hhi) * 100)),
      maxConcentration: largestPosition?.portfolioPct ?? 0,
      maxConcentrationAsset: largestPosition?.symbol ?? '',
      assetsCount: summary.positions.length,
      marketsCount: new Set(summary.positions.map((position) => position.market)).size,
    };
  }

  private async saveSnapshot(
    portfolioId: string,
    summary: Pick<WealthSummary, 'totalValueUsd' | 'totalInvested' | 'totalPnlUsd' | 'totalPnlPct'>,
  ): Promise<void> {
    await this.wealthSnapshotRepository.upsert(
      {
        portfolioId,
        date: this.toDateOnly(new Date()),
        totalValueUsd: summary.totalValueUsd,
        totalInvested: summary.totalInvested,
        pnlUsd: summary.totalPnlUsd,
        pnlPct: summary.totalPnlPct,
      },
      ['portfolioId', 'date'],
    );
  }

  private calculateMarketAllocation(
    positions: AssetAllocation[],
    totalValueUsd: number | null,
  ): MarketAllocation[] {
    const grouped = new Map<AssetMarket, { invested: number; valueUsd: number | null }>();

    for (const position of positions) {
      const current = grouped.get(position.market) ?? { invested: 0, valueUsd: null };
      current.invested += position.totalInvested;
      current.valueUsd =
        position.currentValue !== null
          ? this.roundMoney((current.valueUsd ?? 0) + position.currentValue)
          : current.valueUsd;
      grouped.set(position.market, current);
    }

    return Array.from(grouped.entries()).map(([market, values]) => ({
      market,
      invested: this.roundMoney(values.invested),
      valueUsd: values.valueUsd,
      pct:
        values.valueUsd !== null && totalValueUsd !== null && totalValueUsd > 0
          ? this.roundPct((values.valueUsd / totalValueUsd) * 100)
          : null,
    }));
  }

  private createComparison(
    period: string,
    snapshots: WealthSnapshotEntity[],
    startDate: Date,
    latestSnapshot: WealthSnapshotEntity,
  ): PeriodComparison {
    const startSnapshot = this.findClosestSnapshot(snapshots, startDate);

    if (!startSnapshot) {
      return this.buildEmptyComparison(period);
    }

    const valueStart = startSnapshot.totalValueUsd;
    const valueEnd = latestSnapshot.totalValueUsd;
    const changeUsd =
      valueStart !== null && valueEnd !== null ? this.roundMoney(valueEnd - valueStart) : null;
    const changePct =
      changeUsd !== null && valueStart !== null && valueStart > 0
        ? this.roundPct((changeUsd / valueStart) * 100)
        : null;

    return {
      period,
      valueStart,
      valueEnd,
      changeUsd,
      changePct,
      investedStart: startSnapshot.totalInvested,
      investedEnd: latestSnapshot.totalInvested,
    };
  }

  private buildEmptyComparison(period: string): PeriodComparison {
    return {
      period,
      valueStart: null,
      valueEnd: null,
      changeUsd: null,
      changePct: null,
      investedStart: 0,
      investedEnd: 0,
    };
  }

  private findClosestSnapshot(
    snapshots: WealthSnapshotEntity[],
    targetDate: Date,
  ): WealthSnapshotEntity | null {
    if (snapshots.length === 0) {
      return null;
    }

    const targetTime = this.fromDateOnly(this.toDateOnly(targetDate)).getTime();

    return snapshots.reduce((closest, snapshot) => {
      const currentDiff = Math.abs(this.fromDateOnly(snapshot.date).getTime() - targetTime);

      if (!closest) {
        return snapshot;
      }

      const closestDiff = Math.abs(this.fromDateOnly(closest.date).getTime() - targetTime);
      return currentDiff < closestDiff ? snapshot : closest;
    }, null as WealthSnapshotEntity | null);
  }

  private getDateFromPeriod(period: '7D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL'): Date | null {
    const now = new Date();

    switch (period) {
      case '7D':
        return this.addDays(now, -7);
      case '1M':
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, now.getUTCDate()));
      case '3M':
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, now.getUTCDate()));
      case '6M':
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, now.getUTCDate()));
      case 'YTD':
        return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      case '1Y':
        return new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()));
      case 'ALL':
      default:
        return null;
    }
  }

  private async getOwnedPortfolioOrFail(userId: string, portfolioId: string): Promise<Portfolio> {
    const portfolio = await this.portfolioRepository.findOne({
      where: { id: portfolioId, userId },
    });

    if (!portfolio) {
      throw new NotFoundException('No se encontro el portfolio solicitado para el usuario.');
    }

    return portfolio;
  }

  private addDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private fromDateOnly(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private roundMoney(value: number): number {
    return Number(value.toFixed(2));
  }

  private roundPct(value: number): number {
    return Number(value.toFixed(4));
  }

  private roundQuantity(value: number): number {
    return Number(value.toFixed(8));
  }
}
