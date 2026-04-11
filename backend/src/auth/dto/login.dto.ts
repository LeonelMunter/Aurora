import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'usuario@aurora.dev' })
  @IsEmail({}, { message: 'El email debe tener un formato valido.' })
  email!: string;

  @ApiProperty({ example: 'ClaveSegura1' })
  @IsString({ message: 'La contrasena debe ser un texto.' })
  @IsNotEmpty({ message: 'La contrasena es obligatoria.' })
  password!: string;
}
