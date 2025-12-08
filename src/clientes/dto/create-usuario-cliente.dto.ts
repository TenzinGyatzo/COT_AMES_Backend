import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsMongoId,
  MinLength,
  IsOptional,
} from 'class-validator';

export class CreateUsuarioClienteDto {
  @ApiProperty({
    description: 'Correo electrónico del usuario cliente',
    example: 'usuario@empresa.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario (mínimo 6 caracteres)',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Nombre completo del usuario cliente',
    example: 'Juan Pérez',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  nombre: string;

  @ApiPropertyOptional({
    description: 'Teléfono del usuario cliente',
    example: '+52 662 123 4567',
  })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({
    description: 'ID de la empresa cliente a la que pertenece',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  clienteId: string;
}
