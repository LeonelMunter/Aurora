import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Portfolio } from './portfolio.entity';

const decimalTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null => (value === null ? null : parseFloat(value)),
};

@Entity('wealth_snapshots')
@Unique(['portfolioId', 'date'])
@Index(['portfolioId', 'date'])
export class WealthSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'portfolio_id', type: 'uuid', nullable: false })
  portfolioId!: string;

  @Index()
  @Column({ type: 'date', nullable: false })
  date!: string;

  @Column({
    name: 'total_value_usd',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  totalValueUsd!: number | null;

  @Column({
    name: 'total_invested',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: false,
    transformer: {
      to: (value: number): number => value,
      from: (value: string): number => parseFloat(value),
    },
  })
  totalInvested!: number;

  @Column({
    name: 'pnl_usd',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  pnlUsd!: number | null;

  @Column({
    name: 'pnl_pct',
    type: 'decimal',
    precision: 8,
    scale: 4,
    nullable: true,
    transformer: decimalTransformer,
  })
  pnlPct!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @ManyToOne(() => Portfolio, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: Portfolio;
}
