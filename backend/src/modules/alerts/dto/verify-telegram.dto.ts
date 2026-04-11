import { IsString, MinLength } from 'class-validator';

export class VerifyTelegramDto {
  @IsString()
  @MinLength(3)
  chatId!: string;
}
