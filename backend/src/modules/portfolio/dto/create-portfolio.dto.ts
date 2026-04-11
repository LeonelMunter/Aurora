import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePortfolioDto {
  @ApiPropertyOptional({ example: 'Mi portfolio principal' })
  @IsString({ message: 'El nombre debe ser un texto.' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(50, { message: 'El nombre no puede superar los 50 caracteres.' })
  name!: string;

  @ApiPropertyOptional({ example: 'USD', enum: ['USD', 'ARS'], default: 'USD' })
  @IsOptional()
  @Type(() => String)
  @IsString({ message: 'La moneda base debe ser un texto.' })
  @IsIn(['USD', 'ARS'], { message: 'La moneda base debe ser USD o ARS.' })
  baseCurrency: string = 'USD';
}
