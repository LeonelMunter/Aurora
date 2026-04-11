import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

const decimalTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null => (value === null ? null : parseFloat(value)),
};

export enum NewsSource {
  COINDESK = 'COINDESK',
  COINTELEGRAPH = 'COINTELEGRAPH',
  AMBITO = 'AMBITO',
  CRONISTA = 'CRONISTA',
  REUTERS = 'REUTERS',
  REDDIT = 'REDDIT',
  TELEGRAM = 'TELEGRAM',
  OTHER = 'OTHER',
}

export enum NewsSentiment {
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
  NEUTRAL = 'NEUTRAL',
}

export enum SentimentIntensity {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

@Entity('news_items')
@Unique(['url'])
@Index(['publishedAt'])
@Index(['source'])
@Index(['isRelevant'])
@Index(['symbols'])
export class NewsItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', nullable: false })
  title!: string;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: 'text', nullable: false })
  url!: string;

  @Column({ type: 'enum', enum: NewsSource, nullable: false })
  source!: NewsSource;

  @Column({ name: 'published_at', type: 'timestamp with time zone', nullable: false })
  publishedAt!: Date;

  @CreateDateColumn({ name: 'fetched_at', type: 'timestamp with time zone' })
  fetchedAt!: Date;

  @Column({ type: 'varchar', length: 2, nullable: false, default: 'en' })
  language!: 'en' | 'es';

  @Column({ name: 'is_relevant', type: 'boolean', nullable: true, default: null })
  isRelevant!: boolean | null;

  @Column({ type: 'simple-array', nullable: true })
  symbols!: string[] | null;

  @Column({ type: 'enum', enum: NewsSentiment, nullable: true })
  sentiment!: NewsSentiment | null;

  @Column({
    name: 'sentiment_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  sentimentScore!: number | null;

  @Column({ type: 'enum', enum: SentimentIntensity, nullable: true })
  intensity!: SentimentIntensity | null;

  @Column({ name: 'ai_summary', type: 'text', nullable: true })
  aiSummary!: string | null;

  @Column({ name: 'processed_at', type: 'timestamp with time zone', nullable: true })
  processedAt!: Date | null;
}