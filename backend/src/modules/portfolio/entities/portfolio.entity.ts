import { CreateDateColumn, Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { User } from '../../../auth/entities/user.entity';
import { Import } from './import.entity';
import { Transaction } from './transaction.entity';
import { WealthSnapshotEntity } from './wealth-snapshot.entity';

@Entity('portfolios')
export class Portfolio {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId!: string;

  @Column({ type: 'varchar', nullable: false })
  name!: string;

  @Column({ name: 'base_currency', type: 'varchar', default: 'USD' })
  baseCurrency!: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => Transaction, (transaction) => transaction.portfolio)
  transactions!: Transaction[];

  @OneToMany(() => Import, (portfolioImport) => portfolioImport.portfolio)
  imports!: Import[];

  @OneToMany(() => WealthSnapshotEntity, (snapshot) => snapshot.portfolio)
  wealthSnapshots!: WealthSnapshotEntity[];
}
