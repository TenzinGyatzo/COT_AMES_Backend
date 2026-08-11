import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { parseOptionalQueryBoolean } from '../../common/parse-optional-query-boolean';
import {
  ServicioOrden,
  SERVICIO_ORDEN_VALUES,
} from '../enums/servicio-orden.enum';
import { TipoItem, TIPO_ITEM_VALUES } from '../enums/tipo-item.enum';

export class FilterServicioDto {
  @ApiPropertyOptional({
    description: 'Buscar por nombre (parcial, case-insensitive)',
    example: 'Examen',
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de categoría del tenant',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId({ message: 'categoriaId debe ser un ObjectId válido' })
  categoriaId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de ítem (servicio | producto)',
    enum: TIPO_ITEM_VALUES,
    example: TipoItem.SERVICIO,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
  @IsEnum(TipoItem, {
    message: `tipo debe ser una de: ${TIPO_ITEM_VALUES.join(', ')}`,
  })
  tipo?: TipoItem;

  @ApiPropertyOptional({
    description:
      'Filtrar por activo. Omitido = solo activos (default AD-10). true/false explícito.',
    example: true,
  })
  @IsOptional()
  @Transform(parseOptionalQueryBoolean)
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ description: 'Número de página', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Elementos por página',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Orden de listado. creacion = más antiguos primero (default). nombre_asc / nombre_desc = alfabético.',
    enum: SERVICIO_ORDEN_VALUES,
    default: ServicioOrden.CREACION,
  })
  @IsOptional()
  @IsEnum(ServicioOrden, {
    message: `orden debe ser una de: ${SERVICIO_ORDEN_VALUES.join(', ')}`,
  })
  orden?: ServicioOrden;
}
