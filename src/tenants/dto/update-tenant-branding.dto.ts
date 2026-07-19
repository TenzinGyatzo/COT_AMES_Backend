import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** Trim; `null` → '' para permitir limpiar el campo en PATCH. */
function nullOrTrim({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return value === null ? '' : value;
  }
  if (typeof value !== 'string') return value;
  return value.trim();
}

function isSafeSitioWeb(value: string): boolean {
  const lower = value.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return false;
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }
  // Dominio opcional path (sin esquema)
  return /^([a-z0-9-]+\.)+[a-z]{2,}([/:?#].*)?$/i.test(value);
}

function IsSafeSitioWeb(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isSafeSitioWeb',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string' || value === '') return true;
          return isSafeSitioWeb(value);
        },
        defaultMessage() {
          return 'sitioWeb debe ser un dominio o URL http(s) válida';
        },
      },
    });
  };
}

export class UpdateTenantBrandingDto {
  @ApiPropertyOptional({ description: 'Razón social / nombre fiscal' })
  @IsOptional()
  @Transform(nullOrTrim)
  @IsString()
  @MaxLength(200)
  razonSocial?: string | null;

  @ApiPropertyOptional({ description: 'RFC (opcional)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null) return '';
    if (typeof value !== 'string') return value;
    return value.trim().toUpperCase();
  })
  @IsString()
  @MaxLength(20)
  rfc?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrTrim)
  @IsString()
  @MaxLength(500)
  domicilio?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrTrim)
  @IsString()
  @MaxLength(40)
  telefono?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrTrim)
  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsEmail({}, { message: 'emailContacto debe ser un correo válido' })
  @MaxLength(120)
  emailContacto?: string | null;

  @ApiPropertyOptional({ description: 'Sitio web (URL o dominio)' })
  @IsOptional()
  @Transform(nullOrTrim)
  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MaxLength(200)
  @IsSafeSitioWeb()
  sitioWeb?: string | null;
}
