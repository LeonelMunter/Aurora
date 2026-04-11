import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { TransactionType } from '../../../shared/enums';
import { Asset } from './asset.entity';
import { Import } from './import.entity';
import { Portfolio } from './portfolio.entity';

const decimalTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => parseFloat(value),
};

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'portfolio_id', type: 'uuid', nullable: false })
  portfolioId!: string;

  @Column({ name: 'asset_id', type: 'uuid', nullable: false })
  assetId!: string;

  @Column({ type: 'enum', enum: TransactionType, nullable: false })
  type!: TransactionType;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: false,
    transformer: decimalTransformer,
  })
  quantity!: number;

  @Column({
    name: 'price_usd',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: false,
    transformer: decimalTransformer,
  })
  priceUsd!: number;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
    transformer: decimalTransformer,
  })
  fee!: number;

  @Column({
    name: 'total_usd',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: false,
    transformer: decimalTransformer,
  })
  totalUsd!: number;

  @Column({ type: 'timestamp with time zone', nullable: false })
  date!: Date;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'import_id', type: 'uuid', nullable: true })
  importId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @ManyToOne(() => Portfolio, (portfolio) => portfolio.transactions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: Portfolio;

  @ManyToOne(() => Asset, { nullable: false, eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'asset_id' })
  asset!: Asset;

  @ManyToOne(() => Import, { nullable: true, eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'import_id' })
  import!: Import | null;
}
