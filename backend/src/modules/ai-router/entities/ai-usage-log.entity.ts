import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { User } from '../../../auth/entities/user.entity';
import { AiModel } from './ai-model.entity';

const decimalTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => parseFloat(value),
};

@Entity('ai_usage_logs')
export class AiUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'model_id', type: 'uuid', nullable: false })
  modelId!: string;

  @Column({ name: 'task_type', type: 'varchar', nullable: false })
  taskType!: string;

  @Column({ name: 'tokens_input', type: 'integer', default: 0 })
  tokensInput!: number;

  @Column({ name: 'tokens_output', type: 'integer', default: 0 })
  tokensOutput!: number;

  @Column({ name: 'cost_usd', type: 'decimal', precision: 10, scale: 6, transformer: decimalTransformer })
  costUsd!: number;

  @Column({ name: 'session_id', type: 'varchar', nullable: true })
  sessionId!: string | null;

  @Column({ name: 'duration_ms', type: 'integer', default: 0 })
  durationMs!: number;

  @Column({ name: 'is_free_tier', type: 'boolean', default: false })
  isFreeTier!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @ManyToOne(() => AiModel, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'model_id' })
  model!: AiModel;
}
