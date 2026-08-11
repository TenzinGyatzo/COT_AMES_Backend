/**
 * Helpers puros — Story 5.4 / AD-24 migración AMES → categorias dinámicas.
 * Usados por el CLI `scripts/migrate-categorias-ames.ts` y tests Jest.
 */

export const AMES_TENANT_CLAVES = ['queretaro', 'los-mochis'] as const;
export type AmesTenantClave = (typeof AMES_TENANT_CLAVES)[number];

export const SEED_CATEGORIAS = [
  { codigo: 'MED', nombre: 'Médicos' },
  { codigo: 'SH', nombre: 'Seguridad e Higiene' },
  { codigo: 'CAP', nombre: 'Capacitación' },
  { codigo: 'PC', nombre: 'Protección Civil' },
  { codigo: 'EAL', nombre: 'Estudios de Ambiente Laboral' },
  { codigo: 'RME', nombre: 'Recarga y Mantenimiento de Extintores' },
  { codigo: 'VDP', nombre: 'Ventas de Productos' },
  { codigo: 'OTR', nombre: 'Otros' },
] as const;

export type SeedCategoriaCodigo = (typeof SEED_CATEGORIAS)[number]['codigo'];

const SEED_CODIGO_SET = new Set<string>(
  SEED_CATEGORIAS.map((c) => c.codigo),
);

export function normalizeCategoriaCodigo(
  raw: unknown,
): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return code.length > 0 ? code : null;
}

/**
 * Resuelve el código seed destino. Desconocido / vacío → OTR.
 * Retorna `{ codigo, usedFallback }` para logging.
 */
export function resolveSeedCodigo(
  rawCategoria: unknown,
): { codigo: SeedCategoriaCodigo; usedFallback: boolean } {
  const normalized = normalizeCategoriaCodigo(rawCategoria);
  if (normalized && SEED_CODIGO_SET.has(normalized)) {
    return {
      codigo: normalized as SeedCategoriaCodigo,
      usedFallback: false,
    };
  }
  return { codigo: 'OTR', usedFallback: true };
}

/** Ítem necesita remap de enum legacy → categoriaId. */
export function itemNeedsCategoriaRemap(doc: {
  categoria?: unknown;
  categoriaId?: unknown;
}): boolean {
  if (doc.categoria !== undefined && doc.categoria !== null) return true;
  return doc.categoriaId === undefined || doc.categoriaId === null;
}

function isTipoMissing(tipo: unknown): boolean {
  if (tipo === undefined || tipo === null) return true;
  if (typeof tipo !== 'string') return true;
  return tipo.trim() === '';
}

/** Ítem AMES ya con categoriaId pero sin tipo (re-run idempotente). */
export function itemNeedsTipoBackfill(doc: {
  categoriaId?: unknown;
  tipo?: unknown;
  categoria?: unknown;
}): boolean {
  if (itemNeedsCategoriaRemap(doc)) return false;
  return isTipoMissing(doc.tipo);
}
