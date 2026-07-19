import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicCotizacionItemDto {
  @ApiProperty()
  nombre: string;

  @ApiPropertyOptional()
  descripcion?: string;

  @ApiProperty()
  cantidad: number;

  @ApiProperty()
  precioUnitario: number;

  @ApiProperty()
  subtotal: number;
}

export class PublicBrandingDto {
  @ApiPropertyOptional()
  razonSocial?: string;

  @ApiPropertyOptional()
  logoUrl?: string;
}

/** Respuesta acotada para superficie pública (Story 6.9). Sin token/tenant/emails. */
export class PublicCotizacionResponseDto {
  @ApiProperty()
  folio: string;

  @ApiProperty({ enum: ['vigente', 'vencida', 'aceptada', 'rechazada'] })
  estado: string;

  @ApiProperty()
  total: number;

  @ApiProperty({ example: 'MXN' })
  moneda: string;

  @ApiProperty()
  fechaCreacion: string;

  @ApiProperty()
  fechaVencimiento: string;

  @ApiPropertyOptional()
  fechaAceptacion?: string;

  @ApiPropertyOptional()
  fechaRechazo?: string;

  @ApiPropertyOptional()
  nombreEmpresa?: string;

  @ApiPropertyOptional()
  nombreContacto?: string;

  @ApiPropertyOptional()
  telefonoContacto?: string;

  @ApiPropertyOptional()
  personasAEvaluar?: string;

  @ApiProperty({ type: [PublicCotizacionItemDto] })
  items: PublicCotizacionItemDto[];

  @ApiPropertyOptional({ type: PublicBrandingDto })
  branding?: PublicBrandingDto;

  /** true si el PATCH fue no-op (ya en ese estado terminal). */
  @ApiPropertyOptional()
  alreadyResponded?: boolean;
}
