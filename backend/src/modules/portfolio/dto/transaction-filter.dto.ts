import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

import { AssetMarket, TransactionType } from '../../../shared/enums';

export class TransactionFilterDto {
  @ApiPropertyOptional({ example: 'BTC' })
  @IsOptional()
  @IsString({ message: 'El simbolo del activo debe ser un texto.' })
  assetSymbol?: string;

  @ApiPropertyOptional({ enum: TransactionType, example: TransactionType.BUY })
  @IsOptional()
  @IsEnum(TransactionType, { message: 'El tipo de transaccion no es valido.' })
  type?: TransactionType;

  @ApiPropertyOptional({ enum: AssetMarket, example: AssetMarket.CRYPTO })
  @IsOptional()
  @IsEnum(AssetMarket, { message: 'El mercado no es valido.' })
  market?: AssetMarket;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'dateFrom debe tener formato ISO8601.' })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString({}, { message: 'dateTo debe tener formato ISO8601.' })
  dateTo?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La pagina debe ser numerica.' })
  @Min(1, { message: 'La pagina debe ser mayor o igual a 1.' })
  page: number = 1;

  @ApiPropertyOptional({ example: 25, enum: [10, 25, 50, 100], default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El limite debe ser numerico.' })
  @IsIn([10, 25, 50, 100], { message: 'El limite debe ser 10, 25, 50 o 100.' })
  limit: number = 25;
}
