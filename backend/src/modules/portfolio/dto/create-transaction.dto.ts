import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUppercase, MaxLength, Min } from 'class-validator';

import { AssetMarket, TransactionType } from '../../../shared/enums';

export class CreateTransactionDto {
  @ApiProperty({ example: 'BTC' })
  @IsString({ message: 'El simbolo del activo debe ser un texto.' })
  @IsUppercase({ message: 'El simbolo del activo debe estar en mayusculas.' })
  assetSymbol!: string;

  @ApiProperty({ enum: AssetMarket, example: AssetMarket.CRYPTO })
  @IsEnum(AssetMarket, { message: 'El mercado del activo no es valido.' })
  assetMarket!: AssetMarket;

  @ApiProperty({ enum: TransactionType, example: TransactionType.BUY })
  @IsEnum(TransactionType, { message: 'El tipo de transaccion no es valido.' })
  type!: TransactionType;

  @ApiProperty({ example: 0.25 })
  @Type(() => Number)
  @IsNumber({}, { message: 'La cantidad debe ser numerica.' })
  @IsPositive({ message: 'La cantidad debe ser mayor a 0.' })
  quantity!: number;

  @ApiProperty({ example: 68000 })
  @Type(() => Number)
  @IsNumber({}, { message: 'El precio en USD debe ser numerico.' })
  @IsPositive({ message: 'El precio en USD debe ser mayor a 0.' })
  priceUsd!: number;

  @ApiPropertyOptional({ example: 12.5, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La comision debe ser numerica.' })
  @Min(0, { message: 'La comision no puede ser negativa.' })
  fee: number = 0;

  @ApiProperty({ example: '2026-03-23T18:00:00.000Z' })
  @IsDateString({}, { message: 'La fecha debe tener formato ISO8601.' })
  date!: string;

  @ApiPropertyOptional({ example: 'Compra manual en exchange', maxLength: 500 })
  @IsOptional()
  @IsString({ message: 'Las notas deben ser un texto.' })
  @MaxLength(500, { message: 'Las notas no pueden superar los 500 caracteres.' })
  notes?: string;
}
