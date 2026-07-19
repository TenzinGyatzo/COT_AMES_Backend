import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

function emptyToUndef({ value }: { value: unknown }) {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t.length ? t : undefined;
}

function emptyNumberToUndef({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return undefined;
  return value;
}

function nullDescToUndef({ value }: { value: unknown }) {
  if (value === null) return undefined;
  return value;
}

export class CreateItemCotizacionDto {
  @ApiProperty({
    description: 'ID del servicio a cotizar',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  servicioId: string;

  @ApiProperty({
    description: 'Cantidad del servicio',
    example: 2,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  cantidad: number;

  @ApiPropertyOptional({
    description: 'Override de nombre para snapshot (Story 6.4)',
  })
  @IsOptional()
  @Transform(emptyToUndef)
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @ApiPropertyOptional({
    description:
      'Override de descripción para snapshot. String vacío omite descripción.',
  })
  @IsOptional()
  @Transform(nullDescToUndef)
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Override de precio unitario para snapshot',
    minimum: 0,
  })
  @IsOptional()
  @Transform(emptyNumberToUndef)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precioUnitario?: number;
}
