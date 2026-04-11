import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { AssetMarket, TransactionType } from '../../shared/enums';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionFilterDto } from './dto/transaction-filter.dto';
import { Asset } from './entities/asset.entity';
import { Import } from './entities/import.entity';
import { Portfolio } from './entities/portfolio.entity';
import { Transaction } from './entities/transaction.entity';

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export interface Position {
  asset: Asset;
  quantity: number;
  avgCost: number;
  totalInvested: number;
  currentValue: null;
  pnl: null;
}

export interface PortfolioSummary {
  totalInvested: number;
  totalPositions: number;
  transactions: number;
  portfolioName: string;
  baseCurrency: string;
  createdAt: Date;
}

interface PositionAccumulator {
  asset: Asset;
  quantity: number;
  totalInvested: number;
  totalQuantityBought: number;
}

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(Portfolio)
    private readonly portfolioRepository: Repository<Portfolio>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
    @InjectRepository(Import)
    private readonly importRepository: Repository<Import>,
  ) {}

  async createPortfolio(userId: string, dto: CreatePortfolioDto): Promise<Portfolio> {
    const portfoliosCount = await this.portfolioRepository.count({
      where: { userId },
    });

    const portfolio = this.portfolioRepository.create({
      userId,
      name: dto.name.trim(),
      baseCurrency: dto.baseCurrency,
      isDefault: portfoliosCount === 0,
    });

    return this.portfolioRepository.save(portfolio);
  }

  async getUserPortfolios(userId: string): Promise<Portfolio[]> {
    return this.portfolioRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async getDefaultPortfolio(userId: string): Promise<Portfolio> {
    const portfolio = await this.portfolioRepository.findOne({
      where: { userId, isDefault: true },
    });

    if (!portfolio) {
      // Si no hay portfolio por defecto, creamos uno para garantizar carga de sección.
      return this.createPortfolio(userId, { name: 'Portfolio por defecto', baseCurrency: 'USD' });
    }

    return portfolio;
  }

  async createTransaction(
    userId: string,
    portfolioId: string,
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    const portfolio = await this.getOwnedPortfolioOrFail(userId, portfolioId);
    const normalizedSymbol = dto.assetSymbol.trim().toUpperCase();

    let asset = await this.assetRepository.findOne({
      where: {
        symbol: normalizedSymbol,
        market: dto.assetMarket,
      },
    });

    if (!asset) {
      asset = await this.assetRepository.save(
        this.assetRepository.create({
          symbol: normalizedSymbol,
          name: normalizedSymbol,
          market: dto.assetMarket,
          coingeckoId: dto.assetMarket === AssetMarket.CRYPTO ? normalizedSymbol.toLowerCase() : null,
          iolvSymbol: dto.assetMarket === AssetMarket.STOCK_AR ? normalizedSymbol : null,
        }),
      );
    }

    const transaction = this.transactionRepository.create({
      portfolioId: portfolio.id,
      assetId: asset.id,
      type: dto.type,
      quantity: dto.quantity,
      priceUsd: dto.priceUsd,
      fee: dto.fee,
      totalUsd: this.roundMoney(dto.quantity * dto.priceUsd),
      date: new Date(dto.date),
      notes: dto.notes?.trim() || null,
      importId: null,
    });

    await this.transactionRepository.save(transaction);

    const createdTransaction = await this.transactionRepository.findOne({
      where: { id: transaction.id },
      relations: {
        asset: true,
        portfolio: true,
        import: true,
      },
    });

    if (!createdTransaction) {
      throw new NotFoundException('No se pudo recuperar la transaccion creada.');
    }

    return createdTransaction;
  }

  async getTransactions(
    userId: string,
    portfolioId: string,
    filters: TransactionFilterDto,
  ): Promise<PaginatedTransactions> {
    await this.getOwnedPortfolioOrFail(userId, portfolioId);

    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .innerJoin('transaction.portfolio', 'portfolio')
      .leftJoinAndSelect('transaction.asset', 'asset')
      .where('transaction.portfolioId = :portfolioId', { portfolioId })
      .andWhere('portfolio.userId = :userId', { userId });

    this.applyTransactionFilters(queryBuilder, filters);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;

    queryBuilder
      .orderBy('transaction.date', 'DESC')
      .addOrderBy('transaction.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async getPositions(userId: string, portfolioId: string): Promise<Position[]> {
    await this.getOwnedPortfolioOrFail(userId, portfolioId);

    const transactions = await this.transactionRepository.find({
      where: { portfolioId },
      relations: {
        asset: true,
      },
      order: {
        date: 'ASC',
        createdAt: 'ASC',
      },
    });

    const positionsMap = new Map<string, PositionAccumulator>();

    for (const transaction of transactions) {
      const existing = positionsMap.get(transaction.assetId) ?? {
        asset: transaction.asset,
        quantity: 0,
        totalInvested: 0,
        totalQuantityBought: 0,
      };

      existing.quantity += this.getQuantityDelta(transaction.type, transaction.quantity);

      if (transaction.type === TransactionType.BUY) {
        existing.totalInvested += transaction.totalUsd;
        existing.totalQuantityBought += transaction.quantity;
      }

      positionsMap.set(transaction.assetId, existing);
    }

    return Array.from(positionsMap.values())
      .filter((position) => position.quantity > 0)
      .map((position) => ({
        asset: position.asset,
        quantity: this.roundQuantity(position.quantity),
        avgCost:
          position.totalQuantityBought > 0
            ? this.roundMoney(position.totalInvested / position.totalQuantityBought)
            : 0,
        totalInvested: this.roundMoney(position.totalInvested),
        currentValue: null,
        pnl: null,
      }));
  }

  async getPortfolioSummary(userId: string, portfolioId: string): Promise<PortfolioSummary> {
    const portfolio = await this.getOwnedPortfolioOrFail(userId, portfolioId);

    const buyTransactions = await this.transactionRepository.find({
      where: {
        portfolioId,
        type: TransactionType.BUY,
      },
    });

    const totalInvested = buyTransactions.reduce((sum, transaction) => sum + transaction.totalUsd, 0);
    const transactions = await this.transactionRepository.count({
      where: { portfolioId },
    });
    const positions = await this.getPositions(userId, portfolioId);

    return {
      totalInvested: this.roundMoney(totalInvested),
      totalPositions: positions.length,
      transactions,
      portfolioName: portfolio.name,
      baseCurrency: portfolio.baseCurrency,
      createdAt: portfolio.createdAt,
    };
  }

  async deleteTransaction(
    userId: string,
    transactionId: string,
    portfolioId?: string,
  ): Promise<void> {
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .innerJoinAndSelect('transaction.portfolio', 'portfolio')
      .where('transaction.id = :transactionId', { transactionId })
      .andWhere('portfolio.userId = :userId', { userId });

    if (portfolioId) {
      queryBuilder.andWhere('transaction.portfolioId = :portfolioId', { portfolioId });
    }

    const transaction = await queryBuilder.getOne();

    if (!transaction) {
      throw new NotFoundException('No se encontro la transaccion solicitada para el usuario.');
    }

    await this.transactionRepository.remove(transaction);
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

  private applyTransactionFilters(
    queryBuilder: SelectQueryBuilder<Transaction>,
    filters: TransactionFilterDto,
  ): void {
    if (filters.assetSymbol) {
      queryBuilder.andWhere('asset.symbol = :assetSymbol', {
        assetSymbol: filters.assetSymbol.trim().toUpperCase(),
      });
    }

    if (filters.type) {
      queryBuilder.andWhere('transaction.type = :type', { type: filters.type });
    }

    if (filters.market) {
      queryBuilder.andWhere('asset.market = :market', { market: filters.market });
    }

    if (filters.dateFrom) {
      queryBuilder.andWhere('transaction.date >= :dateFrom', {
        dateFrom: new Date(filters.dateFrom),
      });
    }

    if (filters.dateTo) {
      queryBuilder.andWhere('transaction.date <= :dateTo', {
        dateTo: new Date(filters.dateTo),
      });
    }
  }

  private getQuantityDelta(type: TransactionType, quantity: number): number {
    switch (type) {
      case TransactionType.BUY:
      case TransactionType.STAKE:
      case TransactionType.REWARD:
        return quantity;
      case TransactionType.SELL:
      case TransactionType.UNSTAKE:
      case TransactionType.TRANSFER:
      case TransactionType.FEE:
        return -quantity;
      default:
        return 0;
    }
  }

  private roundMoney(value: number): number {
    return Number(value.toFixed(2));
  }

  private roundQuantity(value: number): number {
    return Number(value.toFixed(8));
  }
}
