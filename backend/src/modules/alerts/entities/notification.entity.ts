import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../../auth/entities/user.entity';
import { AlertType, NotificationChannel } from '../alerts.types';
import { Alert } from './alert.entity';

@Entity('notifications')
@Index(['userId'])
@Index(['isRead'])
@Index(['createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId!: string;

  @Column({ name: 'alert_id', type: 'uuid', nullable: true })
  alertId!: string | null;

  @Column({ type: 'enum', enum: AlertType, nullable: false })
  type!: AlertType;

  @Column({ type: 'varchar', nullable: false })
  title!: string;

  @Column({ type: 'text', nullable: false })
  message!: string;

  @Column({ type: 'enum', enum: NotificationChannel, nullable: false })
  channel!: NotificationChannel;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ name: 'sent_at', type: 'timestamp with time zone', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'read_at', type: 'timestamp with time zone', nullable: true })
  readAt!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Alert, (alert) => alert.notifications, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'alert_id' })
  alert!: Alert | null;
}
