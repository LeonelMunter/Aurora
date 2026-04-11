import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { AssetMarket } from '../../../shared/enums';

const decimalTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null => (value === null ? null : parseFloat(value)),
};

@Entity('market_prices')
@Unique(['symbol', 'market'])
export class MarketPrice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: false })
  symbol!: string;

  @Column({ type: 'enum', enum: AssetMarket, nullable: false })
  market!: AssetMarket;

  @Column({ name: 'price_usd', type: 'decimal', precision: 18, scale: 8, nullable: true, transformer: decimalTransformer })
  priceUsd!: number | null;

  @Column({ name: 'price_ars', type: 'decimal', precision: 18, scale: 2, nullable: true, transformer: decimalTransformer })
  priceArs!: number | null;

  @Column({ name: 'currency', type: 'varchar', length: 3, nullable: false, default: 'USD' })
  currency!: 'USD' | 'ARS';

  @Column({ name: 'tc_oficial', type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
  tcOficial!: number | null;

  @Column({ name: 'source', type: 'varchar', nullable: true })
  source!: 'BINANCE' | 'COINGECKO' | 'IOL' | 'RAVA' | 'BCRA' | 'MOCK' | null;

  @Column({ name: 'exchange', type: 'varchar', nullable: true })
  exchange!: 'BYMA' | 'BINANCE' | 'OTHER' | null;

  @Column({ name: 'change_24h', type: 'decimal', precision: 8, scale: 4, nullable: true, transformer: decimalTransformer })
  change24h!: number | null;

  @Column({ name: 'volume_24h', type: 'decimal', precision: 24, scale: 2, nullable: true, transformer: decimalTransformer })
  volume24h!: number | null;

  @Column({ name: 'high_24h', type: 'decimal', precision: 18, scale: 8, nullable: true, transformer: decimalTransformer })
  high24h!: number | null;

  @Column({ name: 'low_24h', type: 'decimal', precision: 18, scale: 8, nullable: true, transformer: decimalTransformer })
  low24h!: number | null;

  @Column({ name: 'market_cap', type: 'decimal', precision: 24, scale: 2, nullable: true, transformer: decimalTransformer })
  marketCap!: number | null;

  @Column({ name: 'last_updated', type: 'timestamp with time zone', nullable: false })
  lastUpdated!: Date;
}