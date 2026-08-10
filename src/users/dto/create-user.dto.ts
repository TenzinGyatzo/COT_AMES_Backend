import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsMongoId,
  MinLength,
} from 'class-validator';
import { Roles } from '../../auth/enums/roles.enum';

export class CreateUserDto {
  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'operativo@ames.mx',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez',
  })
  @IsString()
  nombre: string;

  @ApiProperty({
    description: 'Rol del usuario',
    enum: Roles,
    example: Roles.OPERATIVO,
  })
  @IsEnum(Roles)
  rol: string;

  @ApiPropertyOptional({
    description:
      'Tenant asignado. Opcional si el actor ancla el tenant (JWT o X-Tenant-Id); el servicio lo exige para operativo|admin_tenant cuando no hay anclaje.',
  })
  @IsOptional()
  @IsMongoId({ message: 'tenantId debe ser un ObjectId válido' })
  tenantId?: string;
}
