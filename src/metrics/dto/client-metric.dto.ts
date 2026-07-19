import { ApiProperty } from '@nestjs/swagger';

export class ClientMetricDto {
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
    description: 'Fecha de última cotización',
    example: '2024-01-15T10:30:00.000Z',
    required: false,
  })
  fechaUltimaCotizacion?: Date;

  @ApiProperty({
    description: 'Total de cotizaciones del cliente',
    example: 5,
  })
  totalCotizaciones: number;
}
