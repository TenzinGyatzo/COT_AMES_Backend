import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsMongoId, IsDateString } from 'class-validator';

export class FilterMetricsDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ID de sede',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  sedeId?: string;

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
