import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { AssetMarket } from '../../../shared/enums';

const decimalTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null => (value === null ? null : parseFloat(value)),
};

@Entity('sentiment_scores')
@Index(['symbol'])
@Index(['calculatedAt'])
@Index(['symbol', 'market', 'calculatedAt'])
export class SentimentScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: false })
  symbol!: string;

  @Column({ type: 'enum', enum: AssetMarket, nullable: false })
  market!: AssetMarket;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: false, transformer: decimalTransformer })
  score!: number;

  @Column({
    name: 'news_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  newsScore!: number | null;

  @Column({
    name: 'community_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  communityScore!: number | null;

  @Column({
    name: 'fear_greed_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  fearGreedScore!: number | null;

  @Column({
    name: 'trends_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  trendsScore!: number | null;

  @Column({ name: 'items_analyzed', type: 'int', nullable: false, default: 0 })
  itemsAnalyzed!: number;

  @Column({ name: 'calculated_at', type: 'timestamp with time zone', nullable: false })
  calculatedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}