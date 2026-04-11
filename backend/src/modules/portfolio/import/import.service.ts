import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { parse } from 'csv-parse/sync';
import { Repository } from 'typeorm';

import { ImportStatus } from '../../../shared/enums';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { Import } from '../entities/import.entity';
import { Portfolio } from '../entities/portfolio.entity';
import { Transaction } from '../entities/transaction.entity';
import { PortfolioService } from '../portfolio.service';
import { BinanceParser } from './binance.parser';
import { IolParser } from './iol.parser';
import { IExchangeParser } from './parser.interface';

interface ImportError {
  row: number;
  reason: string;
}

export interface ImportSummary {
  importId: string;
  source: string;
  status: ImportStatus;
  rowsTotal: number;
  rowsOk: number;
  rowsError: number;
  errors: ImportError[];
}

export interface ImportDetail extends Omit<Import, 'errorLog'> {
  errorLog: ImportError[];
}

@Injectable()
export class ImportService {
  private readonly parsers: IExchangeParser[];

  constructor(
    @InjectRepository(Portfolio)
    private readonly portfolioRepository: Repository<Portfolio>,
    @InjectRepository(Import)
    private readonly importRepository: Repository<Import>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly portfolioService: PortfolioService,
    private readonly binanceParser: BinanceParser,
    private readonly iolParser: IolParser,
  ) {
    this.parsers = [this.binanceParser, this.iolParser];
  }

  async processImport(
    userId: string,
    portfolioId: string,
    file: Express.Multer.File,
  ): Promise<ImportSummary> {
    await this.getOwnedPortfolioOrFail(userId, portfolioId);

    const csvContent = file.buffer.toString('utf-8');
    const headers = this.extractHeaders(csvContent);
    const parser = this.detectParser(headers);
    const parseResult = await parser.parse(csvContent);

    const importRecord = await this.importRepository.save(
      this.importRepository.create({
        portfolioId,
        source: parser.source,
        status: ImportStatus.PROCESSING,
        fileName: file.originalname,
        rowsTotal: parseResult.rowsTotal,
        rowsOk: 0,
        rowsError: 0,
        errorLog: null,
      }),
    );

    const processingErrors: ImportError[] = [];
    let rowsOk = 0;

    for (const [index, parsedTransaction] of parseResult.transactions.entries()) {
      const transactionDto: CreateTransactionDto = {
        assetSymbol: parsedTransaction.assetSymbol,
        assetMarket: parsedTransaction.assetMarket,
        type: parsedTransaction.type,
        quantity: parsedTransaction.quantity,
        priceUsd: parsedTransaction.priceUsd,
        fee: parsedTransaction.fee,
        date: parsedTransaction.date.toISOString(),
        notes: parsedTransaction.notes,
      };

      try {
        const createdTransaction = await this.portfolioService.createTransaction(
          userId,
          portfolioId,
          transactionDto,
        );

        await this.transactionRepository.update(createdTransaction.id, {
          importId: importRecord.id,
        });
        rowsOk += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Error desconocido al crear la transaccion.';
        processingErrors.push({
          row: index + 2,
          reason,
        });
      }
    }

    const allErrors = [...parseResult.errors, ...processingErrors];
    const rowsError = allErrors.length;

    await this.importRepository.update(importRecord.id, {
      status: ImportStatus.COMPLETED,
      rowsTotal: parseResult.rowsTotal,
      rowsOk,
      rowsError,
      errorLog: JSON.stringify(allErrors),
    });

    return {
      importId: importRecord.id,
      source: parser.source,
      status: ImportStatus.COMPLETED,
      rowsTotal: parseResult.rowsTotal,
      rowsOk,
      rowsError,
      errors: allErrors,
    };
  }

  async getImports(userId: string, portfolioId: string): Promise<Import[]> {
    await this.getOwnedPortfolioOrFail(userId, portfolioId);

    return this.importRepository.find({
      where: { portfolioId },
      order: { createdAt: 'DESC' },
    });
  }

  async getImportDetail(userId: string, portfolioId: string, importId: string): Promise<ImportDetail> {
    await this.getOwnedPortfolioOrFail(userId, portfolioId);

    const importRecord = await this.importRepository.findOne({
      where: { id: importId, portfolioId },
    });

    if (!importRecord) {
      throw new NotFoundException('No se encontro la importacion solicitada para el usuario.');
    }

    return {
      ...importRecord,
      errorLog: this.parseErrorLog(importRecord.errorLog),
    };
  }

  private extractHeaders(csvContent: string): string[] {
    const rows = parse(csvContent, {
      to_line: 1,
      skip_empty_lines: true,
      trim: true,
    }) as string[][];

    const headers = rows[0];

    if (!headers || headers.length === 0) {
      throw new BadRequestException('El archivo CSV no contiene encabezados validos.');
    }

    return headers.map((header) => header.replace(/^\uFEFF/, '').trim());
  }

  private detectParser(headers: string[]): IExchangeParser {
    const parser = this.parsers.find((candidate) => candidate.canParse(headers));

    if (!parser) {
      throw new BadRequestException(
        'Formato de CSV no reconocido. Formatos soportados: Binance, InvertirOnline',
      );
    }

    return parser;
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

  private parseErrorLog(errorLog: string | null): ImportError[] {
    if (!errorLog) {
      return [];
    }

    try {
      const parsed = JSON.parse(errorLog) as ImportError[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
