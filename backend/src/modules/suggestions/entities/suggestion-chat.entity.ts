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
import { AssetMarket } from '../../../shared/enums';

export enum SuggestionChatRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

@Entity('suggestion_chats')
@Index(['userId', 'sessionId', 'createdAt'])
export class SuggestionChat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId!: string;

  @Column({ name: 'session_id', type: 'varchar', nullable: false })
  sessionId!: string;

  @Column({ type: 'varchar', nullable: true })
  symbol!: string | null;

  @Column({ type: 'enum', enum: AssetMarket, nullable: true })
  market!: AssetMarket | null;

  @Column({ type: 'enum', enum: SuggestionChatRole, nullable: false })
  role!: SuggestionChatRole;

  @Column({ type: 'text', nullable: false })
  content!: string;

  @Column({ name: 'tokens_used', type: 'integer', default: 0 })
  tokensUsed!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
