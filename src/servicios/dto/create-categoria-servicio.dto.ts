import { ApiProperty } from '@nestjs/swagger';
import {
  IsAlphanumeric,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

function trimString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

export class CreateCategoriaServicioDto {
  @ApiProperty({
    description: 'Nombre de la categoría',
    example: 'Médicos',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Debe proporcionar el nombre de la categoría' })
  @MaxLength(200)
  nombre: string;

  @ApiProperty({
    description:
      'Código de 2 o 3 caracteres alfanuméricos (se normaliza a uppercase en service)',
    example: 'med',
    minLength: 2,
    maxLength: 3,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Debe proporcionar el código de la categoría' })
  @Length(2, 3, { message: 'codigo debe tener 2 o 3 caracteres' })
  @IsAlphanumeric('en-US', {
    message: 'codigo debe ser alfanumérico',
  })
  codigo: string;
}
