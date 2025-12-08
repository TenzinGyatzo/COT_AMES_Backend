import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ObservacionDto {
  @ApiPropertyOptional({
    description: 'Texto de la observación',
    example: 'Se requiere atención especial en el área de producción',
  })
  @IsOptional()
  @IsString()
  texto?: string;

  @ApiPropertyOptional({
    description: 'Timestamp de la observación',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  timestamp?: Date;
}

export class UpdateOrdenTrabajoDto {
  @ApiPropertyOptional({
    description: 'Estado de la orden de trabajo',
    enum: ['pendiente', 'en_proceso', 'completada', 'cancelada'],
    example: 'en_proceso',
  })
  @IsOptional()
  @IsEnum(['pendiente', 'en_proceso', 'completada', 'cancelada'])
  estado?: string;

  @ApiPropertyOptional({
    description: 'Array de observaciones de la orden de trabajo',
    type: [ObservacionDto],
    example: [
      { texto: 'Se requiere atención especial', timestamp: '2024-01-15T10:30:00Z' },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ObservacionDto)
  observaciones?: Array<{ texto: string; timestamp?: Date }>;
}
