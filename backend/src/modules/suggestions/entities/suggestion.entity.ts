import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { AssetMarket } from '../../../shared/enums';
import {
  RiskLevel,
  SignalBreakdown,
  SuggestionCategory,
  TimeHorizon,
} from '../suggestions.types';

const decimalTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null => (value === null ? null : Number(value)),
};

@Entity('suggestions')
@Unique(['symbol', 'market'])
@Index(['symbol', 'market', 'calculatedAt'])
@Index(['convictionScore'])
export class Suggestion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: false })
  symbol!: string;

  @Column({ type: 'enum', enum: AssetMarket, nullable: false })
  market!: AssetMarket;

  @Column({ type: 'varchar', nullable: false })
  name!: string;

  @Column({
    name: 'conviction_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    transformer: decimalTransformer,
  })
  convictionScore!: number;

  @Column({ type: 'enum', enum: SuggestionCategory, nullable: false })
  category!: SuggestionCategory;

  @Column({ name: 'time_horizon', type: 'enum', enum: TimeHorizon, nullable: false })
  timeHorizon!: TimeHorizon;

  @Column({ name: 'risk_level', type: 'enum', enum: RiskLevel, nullable: false })
  riskLevel!: RiskLevel;

  @Column({ type: 'jsonb', nullable: false })
  signals!: SignalBreakdown;

  @Column({ type: 'text', nullable: false })
  narrative!: string;

  @Column({ type: 'simple-array', nullable: false, default: '' })
  catalysts!: string[];

  @Column({ type: 'simple-array', nullable: false, default: '' })
  risks!: string[];

  @Column({
    name: 'price_at_analysis',
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
    transformer: decimalTransformer,
  })
  priceAtAnalysis!: number | null;

  @Column({
    name: 'target_price',
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
    transformer: decimalTransformer,
  })
  targetPrice!: number | null;

  @Column({
    name: 'stop_loss',
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
    transformer: decimalTransformer,
  })
  stopLoss!: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'expires_at', type: 'timestamp with time zone', nullable: false })
  expiresAt!: Date;

  @Column({ name: 'calculated_at', type: 'timestamp with time zone', nullable: false })
  calculatedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}
