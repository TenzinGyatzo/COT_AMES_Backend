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
    description: 'Número de veces contratado (desde cotizaciones aceptadas)',
    example: 25,
  })
  vecesSolicitado: number;
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
    description:
      'Número total de cotizaciones en el alcance del filtro (= cotizacionesEmitidas)',
    example: 500,
  })
  cotizacionesTotales: number;

  /** Alias de emitidas = count del match de periodo (todas las cotizaciones del filtro). Story 7.1 / FR-43. */
  @ApiProperty({
    description:
      'Cotizaciones emitidas en el alcance del filtro (= cotizacionesTotales del match)',
    example: 500,
  })
  cotizacionesEmitidas: number;

  @ApiProperty({
    description: 'Cotizaciones en estado aceptada (mismo match de periodo)',
    example: 175,
  })
  cotizacionesAceptadas: number;

  @ApiProperty({
    description: 'Cotizaciones en estado rechazada (mismo match de periodo)',
    example: 40,
  })
  cotizacionesRechazadas: number;

  @ApiProperty({
    description:
      'Tasa de conversión = aceptadas / emitidas (0 si emitidas = 0)',
    example: 0.35,
  })
  tasaConversion: number;

  @ApiProperty({
    description: 'Ingresos totales de cotizaciones aceptadas',
    example: 1500000.0,
  })
  ingresosTotales: number;
}
