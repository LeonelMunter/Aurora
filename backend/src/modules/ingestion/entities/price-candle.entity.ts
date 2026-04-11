import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { AssetMarket } from '../../../shared/enums';

const decimalTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => parseFloat(value),
};

@Entity('price_candles')
@Unique(['symbol', 'market', 'interval', 'openTime'])
@Index(['symbol', 'market', 'interval', 'openTime'])
export class PriceCandle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: false })
  symbol!: string;

  @Column({ type: 'enum', enum: AssetMarket, nullable: false })
  market!: AssetMarket;

  @Column({ type: 'varchar', nullable: false })
  interval!: string;

  @Index()
  @Column({ name: 'open_time', type: 'timestamp with time zone', nullable: false })
  openTime!: Date;

  @Column({ type: 'decimal', precision: 18, scale: 8, transformer: decimalTransformer })
  open!: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, transformer: decimalTransformer })
  high!: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, transformer: decimalTransformer })
  low!: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, transformer: decimalTransformer })
  close!: number;

  @Column({ type: 'decimal', precision: 24, scale: 8, transformer: decimalTransformer })
  volume!: number;

  @Column({ name: 'close_time', type: 'timestamp with time zone', nullable: false })
  closeTime!: Date;
}
