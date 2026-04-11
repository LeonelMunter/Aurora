import { AssetMarket, ImportSource, TransactionType } from '../../../shared/enums';

export interface ParsedTransaction {
  assetSymbol: string;
  assetMarket: AssetMarket;
  type: TransactionType;
  quantity: number;
  priceUsd: number;
  priceArs?: number;
  fee: number;
  date: Date;
  notes: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  rowsTotal: number;
  rowsOk: number;
  rowsError: number;
  errors: Array<{ row: number; reason: string }>;
}

export interface IExchangeParser {
  source: ImportSource;
  canParse(headers: string[]): boolean;
  parse(csvContent: string): Promise<ParseResult>;
}
