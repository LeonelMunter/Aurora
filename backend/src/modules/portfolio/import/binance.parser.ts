import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

import { AssetMarket, ImportSource, TransactionType } from '../../../shared/enums';
import { IExchangeParser, ParsedTransaction, ParseResult } from './parser.interface';

interface BinanceRow {
  'Date(UTC)': string;
  Pair: string;
  Side: string;
  Price: string;
  Executed: string;
  Amount: string;
  Fee: string;
}

@Injectable()
export class BinanceParser implements IExchangeParser {
  readonly source = ImportSource.BINANCE;

  canParse(headers: string[]): boolean {
    return ['Pair', 'Side', 'Executed'].every((header) => headers.includes(header));
  }

  async parse(csvContent: string): Promise<ParseResult> {
    const rows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as BinanceRow[];

    const transactions: ParsedTransaction[] = [];
    const errors: Array<{ row: number; reason: string }> = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;

      try {
        const symbol = this.extractSymbol(row.Pair);
        const type = this.parseType(row.Side);
        const quantity = this.extractNumericValue(row.Executed);
        const priceUsd = this.parseRequiredNumber(row.Price, 'Price');
        const fee = this.extractNumericValue(row.Fee);
        const date = this.parseDate(row['Date(UTC)']);

        transactions.push({
          assetSymbol: symbol,
          assetMarket: AssetMarket.CRYPTO,
          type,
          quantity,
          priceUsd,
          fee,
          date,
          notes: 'Importado desde Binance',
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Error desconocido al parsear la fila.';
        errors.push({ row: rowNumber, reason });
      }
    });

    return {
      transactions,
      rowsTotal: rows.length,
      rowsOk: transactions.length,
      rowsError: errors.length,
      errors,
    };
  }

  private extractSymbol(pair: string): string {
    const normalizedPair = pair.trim().toUpperCase();
    const suffixes = ['USDT', 'BUSD', 'BTC', 'ETH'];

    for (const suffix of suffixes) {
      if (normalizedPair.endsWith(suffix) && normalizedPair.length > suffix.length) {
        return normalizedPair.slice(0, -suffix.length);
      }
    }

    throw new Error(`No se pudo extraer el simbolo base desde el par ${pair}.`);
  }

  private parseType(side: string): TransactionType {
    const normalizedSide = side.trim().toUpperCase();

    if (normalizedSide === 'BUY') {
      return TransactionType.BUY;
    }

    if (normalizedSide === 'SELL') {
      return TransactionType.SELL;
    }

    throw new Error(`El lado ${side} no esta soportado por el parser de Binance.`);
  }

  private extractNumericValue(value: string): number {
    const match = value.trim().match(/-?\d+(?:[.,]\d+)?/);

    if (!match) {
      throw new Error(`No se pudo extraer un numero desde el valor ${value}.`);
    }

    const parsedValue = parseFloat(match[0].replace(',', '.'));

    if (Number.isNaN(parsedValue)) {
      throw new Error(`El valor ${value} no es numerico.`);
    }

    return parsedValue;
  }

  private parseRequiredNumber(value: string, fieldName: string): number {
    const parsedValue = parseFloat(value.replace(',', '.'));

    if (Number.isNaN(parsedValue)) {
      throw new Error(`El campo ${fieldName} no contiene un numero valido.`);
    }

    return parsedValue;
  }

  private parseDate(value: string): Date {
    const isoLikeValue = `${value.trim().replace(' ', 'T')}Z`;
    const parsedDate = new Date(isoLikeValue);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error(`La fecha ${value} no tiene un formato valido.`);
    }

    return parsedDate;
  }
}
