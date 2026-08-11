import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import {
  TipoItem,
  TIPO_ITEM_VALUES,
} from '../../servicios/enums/tipo-item.enum';

export class FilterMetricsDto {
  @ApiPropertyOptional({
    description: 'Fecha desde (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @ApiPropertyOptional({
    description: 'Fecha hasta (ISO string)',
    example: '2024-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  /**
   * Story 7.2 / FR63 — filtro opcional por `items.tipoSnapshot` (post-unwind).
   * Omitido = todos. No aceptar `todos` ni `sin_tipo` como valor.
   */
  @ApiPropertyOptional({
    description:
      'Filtrar agregaciones de línea por tipoSnapshot (producto | servicio). Omitido = todos.',
    enum: TIPO_ITEM_VALUES,
    example: TipoItem.PRODUCTO,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
  @IsEnum(TipoItem, {
    message: `tipo debe ser una de: ${TIPO_ITEM_VALUES.join(', ')}`,
  })
  tipo?: TipoItem;
}
