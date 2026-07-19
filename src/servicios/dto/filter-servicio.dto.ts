import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  CategoriaServicio,
  CATEGORIA_SERVICIO_VALUES,
} from '../enums/categoria-servicio.enum';
import { parseOptionalQueryBoolean } from '../../common/parse-optional-query-boolean';

export class FilterServicioDto {
  @ApiPropertyOptional({
    description: 'Buscar por nombre (parcial, case-insensitive)',
    example: 'Examen',
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por categoría fija',
    enum: CATEGORIA_SERVICIO_VALUES,
    example: CategoriaServicio.MED,
  })
  @IsOptional()
  @IsEnum(CategoriaServicio, {
    message: `categoria debe ser una de: ${CATEGORIA_SERVICIO_VALUES.join(', ')}`,
  })
  categoria?: CategoriaServicio;

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
}
