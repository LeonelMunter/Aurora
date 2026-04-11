import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { ImportSource, ImportStatus } from '../../../shared/enums';
import { Portfolio } from './portfolio.entity';

@Entity('imports')
export class Import {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'portfolio_id', type: 'uuid', nullable: false })
  portfolioId!: string;

  @Column({ type: 'enum', enum: ImportSource, nullable: false })
  source!: ImportSource;

  @Column({ type: 'enum', enum: ImportStatus, default: ImportStatus.PENDING })
  status!: ImportStatus;

  @Column({ name: 'file_name', type: 'varchar', nullable: true })
  fileName!: string | null;

  @Column({ name: 'rows_total', type: 'integer', default: 0 })
  rowsTotal!: number;

  @Column({ name: 'rows_ok', type: 'integer', default: 0 })
  rowsOk!: number;

  @Column({ name: 'rows_error', type: 'integer', default: 0 })
  rowsError!: number;

  @Column({ name: 'error_log', type: 'text', nullable: true })
  errorLog!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;

  @ManyToOne(() => Portfolio, (portfolio) => portfolio.imports, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio!: Portfolio;
}
