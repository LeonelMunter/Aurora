import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

import { AssetMarket, ImportSource, TransactionType } from '../../../shared/enums';
import { IExchangeParser, ParsedTransaction, ParseResult } from './parser.interface';

interface IolRow {
  Fecha: string;
  Tipo: string;
  Especie: string;
  Cantidad: string;
  Precio: string;
  Monto: string;
  Comision: string;
}

@Injectable()
export class IolParser implements IExchangeParser {
  readonly source = ImportSource.IOL;

  private readonly knownBonds = new Set(['AL29', 'AL30', 'AL35', 'AE38', 'AY24', 'GD29', 'GD30', 'GD35', 'TX26']);

  canParse(headers: string[]): boolean {
    return ['Especie', 'Comision'].every((header) => headers.includes(header));
  }

  async parse(csvContent: string): Promise<ParseResult> {
    const rows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as IolRow[];

    const transactions: ParsedTransaction[] = [];
    const errors: Array<{ row: number; reason: string }> = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;

      try {
        const symbol = row.Especie.trim().toUpperCase();
        const priceArs = this.parseRequiredNumber(row.Precio, 'Precio');

        transactions.push({
          assetSymbol: symbol,
          assetMarket: this.detectMarket(symbol),
          type: this.parseType(row.Tipo),
          quantity: this.parseRequiredNumber(row.Cantidad, 'Cantidad'),
          priceUsd: priceArs,
          priceArs,
          fee: this.parseRequiredNumber(row.Comision, 'Comision'),
          date: this.parseDate(row.Fecha),
          notes: 'Importado desde IOL',
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

  private detectMarket(symbol: string): AssetMarket {
    if (this.knownBonds.has(symbol)) {
      return AssetMarket.BOND;
    }

    if (symbol.endsWith('D') && symbol.length === 4) {
      return AssetMarket.STOCK_AR;
    }

    return AssetMarket.STOCK_AR;
  }

  private parseType(value: string): TransactionType {
    const normalizedType = value.trim().toLowerCase();

    if (normalizedType === 'compra') {
      return TransactionType.BUY;
    }

    if (normalizedType === 'venta') {
      return TransactionType.SELL;
    }

    if (normalizedType === 'cobro renta') {
      return TransactionType.REWARD;
    }

    throw new Error(`El tipo ${value} no esta soportado por el parser de IOL.`);
  }

  private parseRequiredNumber(value: string, fieldName: string): number {
    const normalizedValue = value.trim().replace(/\./g, '').replace(',', '.');
    const parsedValue = parseFloat(normalizedValue);

    if (Number.isNaN(parsedValue)) {
      throw new Error(`El campo ${fieldName} no contiene un numero valido.`);
    }

    return parsedValue;
  }

  private parseDate(value: string): Date {
    const [day, month, year] = value.trim().split('/').map((part) => parseInt(part, 10));

    if (!day || !month || !year) {
      throw new Error(`La fecha ${value} no tiene formato dd/MM/yyyy.`);
    }

    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error(`La fecha ${value} no es valida.`);
    }

    return parsedDate;
  }
}
