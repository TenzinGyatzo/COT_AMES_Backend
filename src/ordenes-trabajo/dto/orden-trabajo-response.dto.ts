import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClienteInfoDto {
  @ApiPropertyOptional({
    description: 'ID del cliente',
    example: '507f1f77bcf86cd799439011',
  })
  _id?: string;

  @ApiPropertyOptional({
    description: 'Nombre de la empresa',
    example: 'Empresa ABC S.A. de C.V.',
  })
  empresa?: string;

  @ApiPropertyOptional({
    description: 'Nombre del contacto',
    example: 'Juan Pérez',
  })
  nombreContacto?: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico',
    example: 'cliente@ejemplo.com',
  })
  correo?: string;

  @ApiPropertyOptional({
    description: 'RFC del cliente',
    example: 'ABC123456789',
  })
  rfc?: string;
}

export class UsuarioClienteInfoDto {
  @ApiPropertyOptional({
    description: 'ID del usuario cliente',
    example: '507f1f77bcf86cd799439011',
  })
  _id?: string;

  @ApiPropertyOptional({
    description: 'Nombre del usuario',
    example: 'Juan Pérez',
  })
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Email del usuario',
    example: 'usuario@ejemplo.com',
  })
  email?: string;

  @ApiPropertyOptional({
    description: 'Teléfono del usuario',
    example: '5551234567',
  })
  telefono?: string;
}

export class SedeInfoDto {
  @ApiPropertyOptional({
    description: 'ID de la sede',
    example: '507f1f77bcf86cd799439011',
  })
  _id?: string;

  @ApiPropertyOptional({
    description: 'Ciudad de la sede',
    example: 'Caborca',
  })
  ciudad?: string;

  @ApiPropertyOptional({
    description: 'Clave de la sede',
    example: 'CAB',
  })
  clave?: string;
}

export class ItemCotizacionInfoDto {
  @ApiPropertyOptional({
    description: 'ID del servicio',
    example: '507f1f77bcf86cd799439011',
  })
  servicioId?: string;

  @ApiPropertyOptional({
    description: 'Nombre del servicio (snapshot)',
    example: 'Consulta general',
  })
  nombreServicioSnapshot?: string;

  @ApiPropertyOptional({
    description: 'Descripción del servicio (snapshot)',
    example: 'Consulta médica general de rutina',
  })
  descripcionServicioSnapshot?: string;

  @ApiPropertyOptional({
    description: 'Cantidad',
    example: 2,
  })
  cantidad?: number;
}

export class CotizacionInfoDto {
  @ApiPropertyOptional({
    description: 'ID de la cotización',
    example: '507f1f77bcf86cd799439011',
  })
  _id?: string;

  @ApiPropertyOptional({
    description: 'Folio de la cotización',
    example: 'COT-2024-0001',
  })
  folio?: string;

  @ApiPropertyOptional({
    description: 'Items de la cotización',
    type: [ItemCotizacionInfoDto],
  })
  items?: ItemCotizacionInfoDto[];
}

export class OrdenTrabajoResponseDto {
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
    description: 'ID de la cotización relacionada',
    example: '507f1f77bcf86cd799439011',
  })
  cotizacionId: string;

  @ApiPropertyOptional({
    description: 'Información de la cotización',
    type: CotizacionInfoDto,
  })
  cotizacion?: CotizacionInfoDto;

  @ApiProperty({
    description: 'ID del cliente',
    example: '507f1f77bcf86cd799439011',
  })
  clienteId: string;

  @ApiPropertyOptional({
    description: 'Información del cliente',
    type: ClienteInfoDto,
  })
  cliente?: ClienteInfoDto;

  @ApiProperty({
    description: 'ID del usuario cliente',
    example: '507f1f77bcf86cd799439011',
  })
  usuarioClienteId: string;

  @ApiPropertyOptional({
    description: 'Información del usuario cliente',
    type: UsuarioClienteInfoDto,
  })
  usuarioCliente?: UsuarioClienteInfoDto;

  @ApiProperty({
    description: 'ID de la sede',
    example: '507f1f77bcf86cd799439011',
  })
  sedeId: string;

  @ApiPropertyOptional({
    description: 'Información de la sede',
    type: SedeInfoDto,
  })
  sede?: SedeInfoDto;

  @ApiProperty({
    description: 'Estado de la orden de trabajo',
    enum: ['pendiente', 'en_proceso', 'completada', 'cancelada'],
    example: 'pendiente',
  })
  estado: string;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2024-01-15T10:30:00.000Z',
  })
  fechaCreacion: Date;

  @ApiPropertyOptional({
    description: 'Fecha de inicio',
    example: '2024-01-16T10:30:00.000Z',
  })
  fechaInicio?: Date;

  @ApiPropertyOptional({
    description: 'Fecha de completación',
    example: '2024-01-20T10:30:00.000Z',
  })
  fechaCompletacion?: Date;

  @ApiPropertyOptional({
    description: 'Fecha cuando se estableció el estado pendiente',
    example: '2024-01-15T10:30:00.000Z',
  })
  fechaEstadoPendiente?: Date;

  @ApiPropertyOptional({
    description: 'Fecha cuando se estableció el estado en_proceso',
    example: '2024-01-16T10:30:00.000Z',
  })
  fechaEstadoEnProceso?: Date;

  @ApiPropertyOptional({
    description: 'Fecha cuando se estableció el estado completada',
    example: '2024-01-20T10:30:00.000Z',
  })
  fechaEstadoCompletada?: Date;

  @ApiPropertyOptional({
    description: 'Fecha cuando se estableció el estado cancelada',
    example: '2024-01-18T10:30:00.000Z',
  })
  fechaEstadoCancelada?: Date;

  @ApiPropertyOptional({
    description: 'Array de observaciones de la orden de trabajo',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        texto: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
    example: [
      { texto: 'Se requiere atención especial', timestamp: '2024-01-15T10:30:00Z' },
    ],
  })
  observaciones?: Array<{ texto: string; timestamp: Date }>;

  @ApiProperty({
    description: 'Fecha de creación (timestamp)',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización (timestamp)',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}
