import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

function nullOrTrimEmail({ value }: { value: unknown }) {
  if (value === null) return '';
  if (typeof value !== 'string') return value;
  return value.trim().toLowerCase();
}

/**
 * null → [] (lista vacía válida).
 * Ítems no-string: se dejan para que @IsString({ each: true }) → 400.
 * Trim + lowercase + dedupe cuando todos son string.
 */
function normalizeEmailList({ value }: { value: unknown }) {
  if (value === undefined) return value;
  if (value === null) return [];
  if (!Array.isArray(value)) return value;
  if (value.some((item) => typeof item !== 'string')) {
    return value;
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value as string[]) {
    const e = item.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

export class UpdateTenantEmailDto {
  @ApiPropertyOptional({
    description: 'Remitente From de cotizaciones (vacío limpia)',
  })
  @IsOptional()
  @Transform(nullOrTrimEmail)
  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsEmail({}, { message: 'emailRemitente debe ser un correo válido' })
  @IsString()
  @MaxLength(120)
  emailRemitente?: string | null;

  @ApiPropertyOptional({
    description:
      'Lista de correos adicionales de notificación (puede ser []). Máx. 20. null → [].',
    type: [String],
  })
  @IsOptional()
  @Transform(normalizeEmailList)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @IsEmail(
    {},
    { each: true, message: 'Cada correo de notificación debe ser válido' },
  )
  correosNotificacion?: string[] | null;
}
