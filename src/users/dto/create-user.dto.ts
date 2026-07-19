import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsMongoId,
  MinLength,
  ValidateIf,
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
    description: 'Tenant asignado (obligatorio si rol=operativo)',
  })
  @ValidateIf((o) => o.rol === Roles.OPERATIVO)
  @IsMongoId({ message: 'tenantId debe ser un ObjectId válido' })
  tenantId?: string;
}
