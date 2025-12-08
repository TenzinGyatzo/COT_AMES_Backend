import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsMongoId, IsBoolean } from 'class-validator';

export class FilterServicioDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ID de sede',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  sedeId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
