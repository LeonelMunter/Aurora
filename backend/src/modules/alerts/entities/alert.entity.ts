import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../../auth/entities/user.entity';
import { AssetMarket } from '../../../shared/enums';
import { AlertType, NotificationChannel } from '../alerts.types';
import { Notification } from './notification.entity';

const decimalTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null => (value === null ? null : Number(value)),
};

@Entity('alerts')
@Index(['userId'])
@Index(['symbol'])
@Index(['type'])
@Index(['isActive'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId!: string;

  @Column({ type: 'varchar', nullable: false })
  name!: string;

  @Column({ type: 'enum', enum: AlertType, nullable: false })
  type!: AlertType;

  @Column({ type: 'varchar', nullable: true })
  symbol!: string | null;

  @Column({ type: 'enum', enum: AssetMarket, nullable: true })
  market!: AssetMarket | null;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: false,
    transformer: decimalTransformer,
  })
  threshold!: number;

  @Column({
    name: 'current_value',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
    transformer: decimalTransformer,
  })
  currentValue!: number | null;

  @Column({ type: 'enum', enum: NotificationChannel, nullable: false })
  channel!: NotificationChannel;

  @Column({ name: 'telegram_chat_id', type: 'varchar', nullable: true })
  telegramChatId!: string | null;

  @Column({ name: 'email_address', type: 'varchar', nullable: true })
  emailAddress!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'trigger_count', type: 'int', default: 0 })
  triggerCount!: number;

  @Column({ name: 'last_triggered', type: 'timestamp with time zone', nullable: true })
  lastTriggered!: Date | null;

  @Column({ name: 'cooldown_min', type: 'int', default: 60 })
  cooldownMin!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => Notification, (notification) => notification.alert)
  notifications!: Notification[];
}
