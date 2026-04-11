import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { User } from '../../../auth/entities/user.entity';

const decimalTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => parseFloat(value),
};

@Entity('ai_limits')
export class AiLimit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true, nullable: false })
  userId!: string;

  @Column({ name: 'monthly_limit_usd', type: 'decimal', precision: 10, scale: 2, default: 50, transformer: decimalTransformer })
  monthlyLimitUsd!: number;

  @Column({ name: 'alert_at_pct', type: 'integer', default: 80 })
  alertAtPct!: number;

  @Column({ name: 'block_on_limit', type: 'boolean', default: false })
  blockOnLimit!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
