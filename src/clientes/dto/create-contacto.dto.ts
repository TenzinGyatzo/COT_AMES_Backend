import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

function trimString({ value }: { value: unknown }) {
  if (value === null) return '';
  if (typeof value !== 'string') return value;
  return value.trim();
}

/** Trim + lowercase; null → '' (limpiar en PATCH). */
function nullOrTrimLowerEmail({ value }: { value: unknown }) {
  if (value === null) return '';
  if (typeof value !== 'string') return value;
  return value.trim().toLowerCase();
}

export class CreateContactoDto {
  @ApiProperty({
    description: 'Nombre del contacto',
    example: 'María López',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Debe proporcionar el nombre del contacto' })
  @MaxLength(200)
  nombre: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico (opcional)',
    example: 'maria@empresa.com',
  })
  @IsOptional()
  @Transform(nullOrTrimLowerEmail)
  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsEmail({}, { message: 'Correo inválido' })
  @MaxLength(200)
  correo?: string | null;

  @ApiPropertyOptional({
    description: 'Teléfono (opcional)',
    example: '4421234567',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(40)
  telefono?: string | null;

  @ApiPropertyOptional({
    description: 'Cargo (opcional)',
    example: 'Gerente de RH',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  cargo?: string | null;
}
