import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  CategoriaServicio,
  CATEGORIA_SERVICIO_VALUES,
} from '../enums/categoria-servicio.enum';

function trimString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

export class CreateServicioDto {
  @ApiProperty({
    description: 'Nombre del servicio',
    example: 'Consulta general',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Debe proporcionar el nombre del servicio' })
  @MaxLength(200)
  nombre: string;

  @ApiPropertyOptional({
    description: 'Descripción detallada del servicio',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @ApiProperty({
    description: 'Precio unitario del servicio (MXN)',
    example: 500.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  precioUnitario: number;

  @ApiProperty({
    description: 'Categoría fija del servicio',
    enum: CATEGORIA_SERVICIO_VALUES,
    example: CategoriaServicio.MED,
  })
  @IsEnum(CategoriaServicio, {
    message: `categoria debe ser una de: ${CATEGORIA_SERVICIO_VALUES.join(', ')}`,
  })
  categoria: CategoriaServicio;

  @ApiPropertyOptional({
    description: 'Moneda del precio (forzada a MXN en service)',
    example: 'MXN',
    default: 'MXN',
  })
  @IsOptional()
  @IsString()
  moneda?: string;

  @ApiPropertyOptional({
    description: 'Indica si el servicio está activo',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
