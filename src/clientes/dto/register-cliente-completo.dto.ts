import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsMongoId,
  MinLength,
  IsOptional,
} from 'class-validator';

/**
 * DTO para registro completo de cliente
 * Incluye datos del cliente (empresa) y del usuario que se registra
 */
export class RegisterClienteCompletoDto {
  // Datos del usuario
  @ApiProperty({
    description:
      'Correo electrónico del usuario (será usado también para el cliente si no se especifica correoCliente)',
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
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  nombre: string;

  // Datos del cliente (empresa)
  @ApiPropertyOptional({
    description: 'Nombre de la empresa',
    example: 'Empresa ABC S.A. de C.V.',
  })
  @IsOptional()
  @IsString()
  empresa?: string;

  @ApiPropertyOptional({
    description: 'RFC de la empresa',
    example: 'ABC123456789',
  })
  @IsOptional()
  @IsString()
  rfc?: string;

  @ApiPropertyOptional({
    description:
      'Clave única de la empresa existente a la que se desea unir. Si se proporciona, el sistema buscará un Cliente existente con esta clave y asociará el nuevo usuario a ese Cliente en lugar de crear uno nuevo. La clave puede ser obtenida de cualquier usuario ya registrado en la empresa o del administrador.',
    example: 'A1B2C3D4',
  })
  @IsOptional()
  @IsString()
  claveEmpresa?: string;

  @ApiPropertyOptional({
    description: 'Teléfono del usuario cliente',
    example: '+52 662 123 4567',
  })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional({
    description: 'ID de la sede principal asociada al cliente',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  sedeId?: string;
}
