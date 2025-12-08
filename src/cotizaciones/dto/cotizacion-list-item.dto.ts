import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CotizacionListItemDto {
  @ApiProperty({
    description: 'ID de la cotización',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Folio de la cotización',
    example: 'COT-2024-001',
  })
  folio: string;

  @ApiProperty({
    description: 'Fecha de creación de la cotización',
    example: '2024-01-15T10:30:00.000Z',
  })
  fecha: Date;

  @ApiProperty({
    description: 'Monto total de la cotización',
    example: 15000.0,
  })
  montoTotal: number;

  @ApiProperty({
    description: 'Nombre de la empresa del cliente',
    example: 'Empresa ABC S.A. de C.V.',
    required: false,
  })
  empresa?: string;

  @ApiProperty({
    description: 'Nombre del solicitante',
    example: 'Juan Pérez',
    required: false,
  })
  nombreSolicitante?: string;

  @ApiProperty({
    description: 'Sede relacionada a la cotización',
    example: 'Ciudad de México, CDMX',
    required: false,
  })
  sede?: string;

  @ApiProperty({
    description: 'RFC de la empresa del cliente',
    example: 'ABC123456789',
  })
  rfc: string;

  @ApiProperty({
    description: 'Estado de la cotización',
    enum: ['vigente', 'vencida', 'aceptada', 'rechazada'],
    example: 'vigente',
  })
  estado: string;

  @ApiProperty({
    description: 'URL del PDF de la cotización',
    example: 'https://example.com/pdf/507f1f77bcf86cd799439011',
    required: false,
  })
  pdfUrl?: string;

  @ApiPropertyOptional({
    description: 'Fecha de aceptación de la cotización',
    example: '2024-01-15T10:30:00.000Z',
  })
  fechaAceptacion?: Date;

  @ApiPropertyOptional({
    description: 'Fecha de rechazo de la cotización',
    example: '2024-01-15T10:30:00.000Z',
  })
  fechaRechazo?: Date;

  @ApiPropertyOptional({
    description: 'ID de la orden de trabajo relacionada',
    example: '507f1f77bcf86cd799439011',
  })
  ordenTrabajoId?: string;
}
