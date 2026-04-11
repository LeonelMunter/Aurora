import { CreateDateColumn, Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

import { AssetMarket } from '../../../shared/enums';

@Entity('assets')
@Unique(['symbol', 'market'])
export class Asset {
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

  @Column({ name: 'iolv_symbol', type: 'varchar', nullable: true })
  iolvSymbol!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}
