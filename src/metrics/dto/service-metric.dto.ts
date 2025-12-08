import { ApiProperty } from '@nestjs/swagger';

export class ServiceMetricDto {
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
    description: 'ID de la sede',
    example: '507f1f77bcf86cd799439011',
  })
  sedeId: string;

  @ApiProperty({
    description: 'Clave de la sede',
    example: 'MEX-001',
    required: false,
  })
  claveSede?: string;

  @ApiProperty({
    description: 'Precio unitario del servicio',
    example: 1500.0,
  })
  precioUnitario: number;

  @ApiProperty({
    description:
      'Número de veces que se ha contratado el servicio (desde cotizaciones aceptadas)',
    example: 15,
  })
  vecesContratado: number;
}
