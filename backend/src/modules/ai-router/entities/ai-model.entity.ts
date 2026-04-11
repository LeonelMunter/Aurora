import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

const decimalTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null => (value === null ? null : parseFloat(value)),
};

@Entity('ai_models')
export class AiModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: false })
  provider!: string;

  @Column({ name: 'model_string', type: 'varchar', unique: true, nullable: false })
  modelString!: string;

  @Column({ name: 'version_label', type: 'varchar', nullable: false })
  versionLabel!: string;

  @Column({ name: 'price_input_per_m', type: 'decimal', precision: 10, scale: 4, transformer: decimalTransformer })
  priceInputPerM!: number;

  @Column({ name: 'price_output_per_m', type: 'decimal', precision: 10, scale: 4, transformer: decimalTransformer })
  priceOutputPerM!: number;

  @Column({ name: 'free_tier_limit', type: 'integer', nullable: true })
  freeTierLimit!: number | null;

  @Column({ name: 'free_tier_tokens_day', type: 'integer', nullable: true })
  freeTierTokensDay!: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}
