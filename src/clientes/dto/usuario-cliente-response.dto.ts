import { ApiProperty } from '@nestjs/swagger';

export class UsuarioClienteResponseDto {
  @ApiProperty({
    description: 'ID del usuario cliente',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    description: 'Correo electrónico del usuario cliente',
    example: 'usuario@empresa.com',
  })
  email: string;

  @ApiProperty({
    description: 'Nombre completo del usuario cliente',
    example: 'Juan Pérez',
  })
  nombre: string;

  @ApiProperty({
    description: 'ID de la empresa cliente a la que pertenece',
    example: '507f1f77bcf86cd799439011',
  })
  clienteId: string;

  @ApiProperty({
    description: 'Indica si el usuario está activo',
    example: true,
  })
  activo: boolean;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}
