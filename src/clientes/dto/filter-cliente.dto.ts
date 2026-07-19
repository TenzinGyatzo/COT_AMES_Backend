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

export class FilterClienteDto {
  @ApiPropertyOptional({
    description: 'Filtrar por nombre de empresa',
    example: 'Empresa ABC',
  })
  @IsOptional()
  @IsString()
  empresa?: string;

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
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === 'true') return true;
      if (v === 'false') return false;
      return value; // inválido → @IsBoolean falla 400
    }
    if (value === true || value === false) return value;
    return value;
  })
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
