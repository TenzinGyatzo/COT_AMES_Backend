import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { parseOptionalQueryBoolean } from '../../common/parse-optional-query-boolean';

export class FilterClienteDto {
  @ApiPropertyOptional({
    description: 'Filtrar por nombre de empresa (nombre comercial)',
    example: 'Empresa ABC',
  })
  @IsOptional()
  @IsString()
  empresa?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por razón social',
    example: 'Servicios Industriales',
  })
  @IsOptional()
  @IsString()
  razonSocial?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por RFC',
    example: 'ABC123456789',
  })
  @IsOptional()
  @IsString()
  rfc?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por activo. Omitido = solo activos (default AD-10). true/false explícito.',
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
