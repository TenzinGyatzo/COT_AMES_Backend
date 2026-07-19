import { TransformFnParams } from 'class-transformer';

/**
 * Parsea query booleans con ValidationPipe + enableImplicitConversion.
 * Implicit conversion hace Boolean("false") === true; el plain `obj[key]`
 * conserva el valor original de la query para string/boolean.
 * Otros tipos (objeto anidado, array, etc.) se devuelven tal cual para que
 * `@IsBoolean` rechace con 400 — no usar `value` (ya corrompido por conversión).
 */
export function parseOptionalQueryBoolean({
  value,
  obj,
  key,
}: TransformFnParams): boolean | undefined {
  const raw =
    key && obj && Object.prototype.hasOwnProperty.call(obj, key)
      ? (obj as Record<string, unknown>)[key]
      : value;

  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    if (v === '') return undefined; // solo espacios ≡ omitido
    if (v === 'true') return true;
    if (v === 'false') return false;
    return raw as unknown as boolean; // inválido → @IsBoolean → 400
  }
  if (typeof raw === 'boolean') {
    return raw;
  }
  // Objeto/array/número: devolver raw (no `value`) para fallar @IsBoolean
  return raw as unknown as boolean;
}
