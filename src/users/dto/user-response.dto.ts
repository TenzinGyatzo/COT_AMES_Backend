import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Roles } from '../../auth/enums/roles.enum';

export class UserResponseDto {
  @ApiProperty({ description: 'ID del usuario' })
  _id: string;

  @ApiProperty({ description: 'Correo electrónico del usuario' })
  email: string;

  @ApiProperty({ description: 'Nombre completo del usuario' })
  nombre: string;

  @ApiProperty({ description: 'Rol del usuario', enum: Roles })
  rol: string;

  @ApiPropertyOptional({ description: 'Tenant asignado (operativo)' })
  tenantId?: string;

  @ApiProperty({ description: 'Indica si el usuario está activo' })
  activo: boolean;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  updatedAt: Date;
}
