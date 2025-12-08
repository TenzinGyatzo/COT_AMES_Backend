import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginClienteDto {
  @ApiProperty({
    description: 'Correo electrónico del usuario cliente',
    example: 'usuario@empresa.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'password123',
  })
  @IsString()
  @MinLength(6)
  password: string;
}
