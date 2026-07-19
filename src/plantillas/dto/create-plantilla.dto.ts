import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SeccionPlantillaDto } from './seccion-plantilla.dto';

function trimString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

export class CreatePlantillaDto {
  @ApiProperty({
    description: 'Nombre identificable de la plantilla',
    example: 'Requerimientos Comerciales',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Debe proporcionar el nombre de la plantilla' })
  @MaxLength(200)
  nombre: string;

  @ApiProperty({
    description: 'Secciones JSON v1 (richtext | tabla). Mínimo 1.',
    type: [SeccionPlantillaDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos una sección' })
  @ValidateNested({ each: true })
  @Type(() => SeccionPlantillaDto)
  secciones: SeccionPlantillaDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
