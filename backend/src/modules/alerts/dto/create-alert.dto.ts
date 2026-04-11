import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsNumber, IsOptional, IsPositive, IsString, Min, MinLength } from 'class-validator';

import { AssetMarket } from '../../../shared/enums';
import { AlertType, NotificationChannel } from '../alerts.types';

export class CreateAlertDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsEnum(AlertType)
  type!: AlertType;

  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsEnum(AssetMarket)
  market?: AssetMarket;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  threshold!: number;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsOptional()
  @IsString()
  telegramChatId?: string;

  @IsOptional()
  @IsEmail()
  emailAddress?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  cooldownMin: number = 60;
}
