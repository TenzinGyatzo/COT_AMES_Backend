import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FilterCotizacionDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: ['vigente', 'vencida', 'aceptada', 'rechazada'],
    example: 'vigente',
  })
  @IsOptional()
  @IsEnum(['vigente', 'vencida', 'aceptada', 'rechazada'])
  estado?: string;

  @ApiPropertyOptional({
    description:
      'Búsqueda por folio, empresa, solicitante, RFC o correo (case-insensitive)',
    example: 'COT-2026-0001',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Número de página',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Número de elementos por página',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

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
}
