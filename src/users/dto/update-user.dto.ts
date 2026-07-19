import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsMongoId,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Roles } from '../../auth/enums/roles.enum';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Correo electrónico del usuario',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Nueva contraseña del usuario',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({
    description: 'Nombre completo del usuario',
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Rol del usuario',
    enum: Roles,
  })
  @IsOptional()
  @IsEnum(Roles)
  rol?: string;

  @ApiPropertyOptional({
    description:
      'Tenant asignado (obligatorio si el rol efectivo es operativo)',
  })
  @IsOptional()
  @ValidateIf((o) => o.tenantId !== null && o.tenantId !== undefined)
  @IsMongoId()
  tenantId?: string | null;

  @ApiPropertyOptional({
    description: 'Indica si el usuario está activo',
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
