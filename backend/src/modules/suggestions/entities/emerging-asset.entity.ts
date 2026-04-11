import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { AssetMarket } from '../../../shared/enums';

const decimalTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null => (value === null ? null : Number(value)),
};

export type ListingExchange = 'BINANCE' | 'BYMA' | 'OTHER';
export type EmergingAssetSource =
  | 'COINGECKO_NEW'
  | 'BINANCE_LISTING'
  | 'BYMA_LISTING'
  | 'MANUAL';

@Entity('emerging_assets')
@Unique(['symbol'])
@Index(['market'])
@Index(['discoveredAt'])
export class EmergingAsset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: false })
  symbol!: string;

  @Column({ type: 'varchar', nullable: false })
  name!: string;

  @Column({ type: 'enum', enum: AssetMarket, nullable: false })
  market!: AssetMarket;

  @Column({ name: 'coingecko_id', type: 'varchar', nullable: true })
  coingeckoId!: string | null;

  @Column({ name: 'discovered_at', type: 'timestamp with time zone', nullable: false })
  discoveredAt!: Date;

  @Column({ name: 'listing_date', type: 'timestamp with time zone', nullable: true })
  listingDate!: Date | null;

  @Column({ name: 'listing_exchange', type: 'varchar', nullable: true })
  listingExchange!: ListingExchange | null;

  @Column({
    name: 'market_cap',
    type: 'decimal',
    precision: 24,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  marketCap!: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', nullable: false })
  source!: EmergingAssetSource;
}
