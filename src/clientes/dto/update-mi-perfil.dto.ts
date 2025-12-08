import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, MinLength } from 'class-validator';

export class UpdateMiPerfilDto {
  @ApiPropertyOptional({
    description: 'Nombre completo del usuario cliente',
    example: 'Juan Pérez',
    minLength: 2,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico del usuario cliente',
    example: 'usuario@empresa.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Teléfono del usuario cliente',
    example: '+52 662 123 4567',
  })
  @IsOptional()
  @IsString()
  telefono?: string;
}
