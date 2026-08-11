import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsBoolean,
  IsNotEmpty,
  MaxLength,
  IsMongoId,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoItem, TIPO_ITEM_VALUES } from '../enums/tipo-item.enum';

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
    description:
      'ID de categoría activa del tenant (ObjectId). Ya no se acepta enum MED…OTR.',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId({ message: 'categoriaId debe ser un ObjectId válido' })
  categoriaId: string;

  @ApiProperty({
    description: 'Discriminador catálogo unificado (AD-19 / FR-58)',
    enum: TIPO_ITEM_VALUES,
    example: TipoItem.SERVICIO,
  })
  @IsEnum(TipoItem, {
    message: `tipo debe ser una de: ${TIPO_ITEM_VALUES.join(', ')}`,
  })
  tipo: TipoItem;

  @ApiPropertyOptional({
    description:
      'Código interno opcional (único por tenant si presente; AD-21 / FR-59)',
    example: 'SKU-001',
    maxLength: 64,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(64)
  codigo?: string;

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
