import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsMongoId,
  IsString,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FilterOrdenTrabajoDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ID de cliente',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  clienteId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de sede',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  sedeId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: ['pendiente', 'en_proceso', 'completada', 'cancelada'],
    example: 'pendiente',
  })
  @IsOptional()
  @IsEnum(['pendiente', 'en_proceso', 'completada', 'cancelada'])
  estado?: string;

  @ApiPropertyOptional({
    description:
      'Búsqueda por folio, empresa, estado, sede, contacto o folio de cotización',
    example: 'OT-MEX-2024-0001',
  })
  @IsOptional()
  @IsString()
  search?: string;

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
}
