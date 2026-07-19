import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export const ESTADOS_COTIZACION = [
  'vigente',
  'vencida',
  'aceptada',
  'rechazada',
] as const;

export type EstadoCotizacion = (typeof ESTADOS_COTIZACION)[number];

/** Body para cambio manual de estado (Story 6.10 / FR-27). */
export class CambiarEstadoDto {
  @ApiProperty({
    enum: ESTADOS_COTIZACION,
    description: 'Nuevo estado (debe ser distinto al actual)',
  })
  @IsString()
  @IsIn([...ESTADOS_COTIZACION])
  estado: EstadoCotizacion;

  @ApiPropertyOptional({
    description:
      'Obligatoria/futura al marcar vigente si se envía; si se omite, se extiende con vigenciaDefaultDias del tenant',
    example: '2030-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;
}
