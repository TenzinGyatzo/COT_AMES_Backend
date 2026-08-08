import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Envelope 201 de POST :id/repetir (estado cancelada + cancelarOriginal). */
export class RepetirCotizacionResponseDto {
  @ApiProperty({
    description: 'Cotización nueva creada (siempre presente)',
    type: 'object',
    additionalProperties: true,
  })
  // Documento Cotizacion (Nest serializa a JSON); tipado laxo para evitar acoplar schema aquí.
  cotizacion: object;

  @ApiProperty({
    description:
      'true si la fuente quedó o ya estaba cancelada tras el intento; false si no se pidió o falló',
  })
  originalCancelada: boolean;

  @ApiPropertyOptional({
    description: 'Mensaje si se pidió cancelarOriginal y la cancelación falló',
  })
  originalCancelacionError?: string;
}
