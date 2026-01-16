import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrdenTrabajoListItemDto {
  @ApiProperty({
    description: 'ID de la orden de trabajo',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Folio de la orden de trabajo',
    example: 'OT-CAB-2024-0001',
  })
  folio: string;

  @ApiProperty({
    description: 'Fecha de creación de la orden',
    example: '2024-01-15T10:30:00.000Z',
  })
  fechaCreacion: Date;

  @ApiProperty({
    description: 'Estado de la orden de trabajo',
    enum: ['pendiente', 'en_proceso', 'completada', 'cancelada'],
    example: 'pendiente',
  })
  estado: string;

  @ApiPropertyOptional({
    description: 'Nombre de la empresa del cliente',
    example: 'Empresa ABC S.A. de C.V.',
  })
  empresa?: string;

  @ApiPropertyOptional({
    description: 'Nombre del solicitante',
    example: 'Juan Pérez',
  })
  nombreSolicitante?: string;

  @ApiPropertyOptional({
    description: 'Ciudad de la sede',
    example: 'Caborca',
  })
  nombreSede?: string;

  @ApiPropertyOptional({
    description: 'Folio de la cotización relacionada',
    example: 'COT-2024-0001',
  })
  folioCotizacion?: string;
}
