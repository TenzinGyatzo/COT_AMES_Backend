import { ApiProperty } from '@nestjs/swagger';

export class ClienteSolicitanteDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: '507f1f77bcf86cd799439011',
  })
  clienteId: string;

  @ApiProperty({
    description: 'Nombre de la empresa',
    example: 'Empresa ABC S.A. de C.V.',
    required: false,
  })
  empresa?: string;

  @ApiProperty({
    description: 'RFC de la empresa',
    example: 'ABC123456789',
  })
  rfc: string;

  @ApiProperty({
    description: 'Nombre del usuario cliente con más cotizaciones',
    example: 'Juan Pérez',
    required: false,
  })
  nombreUsuarioCliente?: string;

  @ApiProperty({
    description: 'Total de cotizaciones',
    example: 10,
  })
  totalCotizaciones: number;
}

export class ServicioSolicitadoDto {
  @ApiProperty({
    description: 'ID del servicio',
    example: '507f1f77bcf86cd799439011',
  })
  servicioId: string;

  @ApiProperty({
    description: 'Nombre del servicio',
    example: 'Servicio de Consultoría',
  })
  nombreServicio: string;

  @ApiProperty({
    description: 'Clave de la sede del servicio',
    example: 'MEX-001',
    required: false,
  })
  claveSede?: string;

  @ApiProperty({
    description: 'Número de veces contratado (desde cotizaciones aceptadas)',
    example: 25,
  })
  vecesSolicitado: number; // Mantenemos el nombre por compatibilidad con el frontend
}

export class ServicioRentableDto {
  @ApiProperty({
    description: 'ID del servicio',
    example: '507f1f77bcf86cd799439011',
  })
  servicioId: string;

  @ApiProperty({
    description: 'Nombre del servicio',
    example: 'Servicio de Consultoría',
  })
  nombreServicio: string;

  @ApiProperty({
    description: 'Clave de la sede del servicio',
    example: 'MEX-001',
    required: false,
  })
  claveSede?: string;

  @ApiProperty({
    description: 'Ingresos totales generados por el servicio',
    example: 150000.0,
  })
  ingresosTotales: number;
}

export class TotalsMetricDto {
  @ApiProperty({
    description: 'Cliente con más cotizaciones',
    type: ClienteSolicitanteDto,
    required: false,
  })
  mayorSolicitante?: ClienteSolicitanteDto;

  @ApiProperty({
    description: 'Cliente más activo del mes actual',
    type: ClienteSolicitanteDto,
    required: false,
  })
  clienteMasActivoMes?: ClienteSolicitanteDto;

  @ApiProperty({
    description: 'Servicio más contratado',
    type: ServicioSolicitadoDto,
    required: false,
  })
  servicioMasSolicitado?: ServicioSolicitadoDto;

  @ApiProperty({
    description: 'Servicio más rentable (por ingresos)',
    type: ServicioRentableDto,
    required: false,
  })
  servicioMasRentable?: ServicioRentableDto;

  @ApiProperty({
    description: 'Número de cotizaciones creadas hoy',
    example: 5,
  })
  cotizacionesHoy: number;

  @ApiProperty({
    description: 'Número de cotizaciones creadas este mes',
    example: 45,
  })
  cotizacionesMes: number;

  @ApiProperty({
    description: 'Número de cotizaciones creadas este año',
    example: 250,
  })
  cotizacionesAnio: number;

  @ApiProperty({
    description: 'Número total de cotizaciones (sin filtro de año)',
    example: 500,
  })
  cotizacionesTotales: number;

  @ApiProperty({
    description: 'Tasa de conversión (cotizaciones aceptadas / totales)',
    example: 0.35,
  })
  tasaConversion: number;

  @ApiProperty({
    description: 'Ingresos totales de cotizaciones aceptadas',
    example: 1500000.0,
  })
  ingresosTotales: number;
}
