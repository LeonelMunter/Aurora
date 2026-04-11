import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'usuario@aurora.dev' })
  @IsEmail({}, { message: 'El email debe tener un formato valido.' })
  email!: string;

  @ApiProperty({ example: 'Leonel Vega' })
  @IsString({ message: 'El nombre debe ser un texto.' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(50, { message: 'El nombre no puede superar los 50 caracteres.' })
  name!: string;

  @ApiProperty({ example: 'ClaveSegura1' })
  @IsString({ message: 'La contrasena debe ser un texto.' })
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres.' })
  @Matches(/^(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La contrasena debe contener al menos una mayuscula y un numero.',
  })
  password!: string;
}
