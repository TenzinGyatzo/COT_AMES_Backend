import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { parseOptionalQueryBoolean } from '../../common/parse-optional-query-boolean';

export class FilterCategoriaServicioDto {
  @ApiPropertyOptional({
    description:
      'Filtrar por activo. Omitido = solo activas (default AD-10). true/false explícito.',
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
