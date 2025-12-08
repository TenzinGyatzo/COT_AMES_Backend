import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'ID del usuario' })
  _id: string;

  @ApiProperty({ description: 'Correo electrónico del usuario' })
  email: string;

  @ApiProperty({ description: 'Nombre completo del usuario' })
  nombre: string;

  @ApiProperty({ description: 'Rol del usuario', enum: ['admin'] })
  rol: string;

  @ApiProperty({ description: 'Indica si el usuario está activo' })
  activo: boolean;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  updatedAt: Date;
}
