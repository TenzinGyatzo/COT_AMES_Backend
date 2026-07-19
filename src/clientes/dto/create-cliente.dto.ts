import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

function trimString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

/** Trim + uppercase; null → '' para permitir limpiar en PATCH. */
function nullOrTrimUpperRfc({ value }: { value: unknown }) {
  if (value === null) return '';
  if (typeof value !== 'string') return value;
  return value.trim().toUpperCase();
}

export class CreateClienteDto {
  @ApiProperty({
    description: 'Nombre de la empresa del cliente',
    example: 'Empresa ABC S.A. de C.V.',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Debe proporcionar el nombre de la empresa' })
  @MaxLength(200)
  empresa: string;

  @ApiPropertyOptional({
    description: 'RFC de la empresa (opcional; único por tenant entre activos)',
    example: 'ABC123456789',
  })
  @IsOptional()
  @Transform(nullOrTrimUpperRfc)
  @IsString()
  @MaxLength(20)
  rfc?: string | null;

  // `activo` no se acepta en create/update de 3.1 (soft-delete → 3.2).
}
