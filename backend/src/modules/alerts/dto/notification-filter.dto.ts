import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, Max, Min } from 'class-validator';

import { AlertType } from '../alerts.types';

export class NotificationFilterDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsEnum(AlertType)
  type?: AlertType;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit: number = 20;
}
