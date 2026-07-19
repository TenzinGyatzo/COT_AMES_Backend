import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export const MODOS_PRECIOS_REPETIR = ['originales', 'actualizados'] as const;
export type ModoPreciosRepetir = (typeof MODOS_PRECIOS_REPETIR)[number];

export class SustitucionServicioDto {
  @ApiProperty({ description: 'servicioId del ítem fuente a reemplazar' })
  @IsMongoId()
  fromServicioId: string;

  @ApiProperty({ description: 'servicioId activo del catálogo (mismo tenant)' })
  @IsMongoId()
  toServicioId: string;
}

/** Body para repetir cotización (Story 6.12 / FR-35 / FR-36). */
export class RepetirCotizacionDto {
  @ApiProperty({
    enum: MODOS_PRECIOS_REPETIR,
    description:
      'originales = snapshot de la fuente; actualizados = catálogo vigente',
  })
  @IsString()
  @IsIn([...MODOS_PRECIOS_REPETIR])
  modoPrecios: ModoPreciosRepetir;

  @ApiPropertyOptional({
    type: [String],
    description: 'servicioId de ítems a excluir (tras warning o elección)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  omitirServicioIds?: string[];

  @ApiPropertyOptional({
    type: [SustitucionServicioDto],
    description: 'Reemplazos de servicio (cantidad se conserva del ítem origen)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SustitucionServicioDto)
  sustituciones?: SustitucionServicioDto[];

  @ApiPropertyOptional({
    description:
      'Si se omite, vigencia recalculada con vigenciaDefaultDias del tenant',
    example: '2030-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;
}
