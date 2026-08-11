/**
 * Orquestación de migración AMES (inyectable con collections / mocks).
 * Story 5.4 / AD-24.
 */
import { Types } from 'mongoose';
import {
  AMES_TENANT_CLAVES,
  SEED_CATEGORIAS,
  itemNeedsCategoriaRemap,
  itemNeedsTipoBackfill,
  resolveSeedCodigo,
} from './migrate-categorias-ames.helpers';

export type MigrateLogger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
};

export type TenantDoc = {
  _id: Types.ObjectId;
  clave: string;
  nombre?: string;
};

export type CategoriaDoc = {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  codigo: string;
  nombre: string;
  activo?: boolean;
};

export type ServicioDoc = {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  categoria?: string;
  categoriaId?: Types.ObjectId;
  tipo?: string;
};

export type TenantsCollection = {
  find: (filter: {
    clave: { $in: readonly string[] };
  }) => { toArray: () => Promise<TenantDoc[]> };
};

export type CategoriasCollection = {
  findOneAndUpdate: (
    filter: { tenantId: Types.ObjectId; codigo: string },
    update: Record<string, unknown>,
    options: { upsert: boolean; returnDocument: 'after' },
  ) => Promise<CategoriaDoc | null>;
};

export type ServiciosCollection = {
  find: (filter: Record<string, unknown>) => {
    toArray: () => Promise<ServicioDoc[]>;
  };
  updateOne: (
    filter: { _id: Types.ObjectId },
    update: Record<string, unknown>,
  ) => Promise<{ matchedCount?: number } | null | undefined>;
};

export type MigrateDeps = {
  tenants: TenantsCollection;
  categorias: CategoriasCollection;
  servicios: ServiciosCollection;
  log?: MigrateLogger;
};

export type MigrateResult = {
  tenantsProcessed: string[];
  categoriesUpserted: number;
  itemsRemapped: number;
  itemsTipoBackfilled: number;
  warnings: number;
};

const defaultLog: MigrateLogger = {
  info: (m) => console.log(m),
  warn: (m) => console.warn(m),
};

export async function runMigrateCategoriasAmes(
  deps: MigrateDeps,
): Promise<MigrateResult> {
  const log = deps.log ?? defaultLog;

  const found = await deps.tenants
    .find({ clave: { $in: AMES_TENANT_CLAVES } })
    .toArray();

  const byClave = new Map(found.map((t) => [t.clave, t]));
  const missing = AMES_TENANT_CLAVES.filter((c) => !byClave.has(c));
  if (missing.length > 0) {
    throw new Error(
      `Faltan tenants AMES con clave: ${missing.join(', ')}. ` +
        `No se crean tenants; abortando migración.`,
    );
  }

  const result: MigrateResult = {
    tenantsProcessed: [],
    categoriesUpserted: 0,
    itemsRemapped: 0,
    itemsTipoBackfilled: 0,
    warnings: 0,
  };

  for (const clave of AMES_TENANT_CLAVES) {
    const tenant = byClave.get(clave)!;
    result.tenantsProcessed.push(clave);
    log.info(
      `→ Tenant ${clave} (${tenant.nombre ?? ''}) id=${String(tenant._id)}`,
    );

    const codigoToId = new Map<string, Types.ObjectId>();

    for (const seed of SEED_CATEGORIAS) {
      const doc = await deps.categorias.findOneAndUpdate(
        { tenantId: tenant._id, codigo: seed.codigo },
        {
          $setOnInsert: {
            nombre: seed.nombre,
            tenantId: tenant._id,
            codigo: seed.codigo,
            activo: true,
          },
          $set: { activo: true },
        },
        { upsert: true, returnDocument: 'after' },
      );
      if (!doc?._id) {
        throw new Error(
          `No se pudo upsert categoría ${seed.codigo} en tenant ${clave}`,
        );
      }
      codigoToId.set(seed.codigo, doc._id);
      result.categoriesUpserted += 1;
    }

    const items = await deps.servicios
      .find({ tenantId: tenant._id })
      .toArray();

    for (const item of items) {
      if (itemNeedsCategoriaRemap(item)) {
        const { codigo, usedFallback } = resolveSeedCodigo(item.categoria);
        if (usedFallback) {
          result.warnings += 1;
          log.warn(
            `  ítem ${String(item._id)}: categoria=${JSON.stringify(item.categoria)} → OTR`,
          );
        }
        const categoriaId = codigoToId.get(codigo);
        if (!categoriaId) {
          throw new Error(
            `Mapa incompleto: falta ${codigo} en tenant ${clave}`,
          );
        }
        const remapRes = await deps.servicios.updateOne(
          { _id: item._id },
          {
            $set: { categoriaId, tipo: 'servicio' },
            $unset: { categoria: '' },
          },
        );
        if (!remapRes?.matchedCount) {
          throw new Error(
            `Remap no-op: servicio ${String(item._id)} no encontrado en tenant ${clave}`,
          );
        }
        result.itemsRemapped += 1;
        continue;
      }

      if (itemNeedsTipoBackfill(item)) {
        const backfillRes = await deps.servicios.updateOne(
          { _id: item._id },
          { $set: { tipo: 'servicio' } },
        );
        if (!backfillRes?.matchedCount) {
          throw new Error(
            `Tipo backfill no-op: servicio ${String(item._id)} no encontrado en tenant ${clave}`,
          );
        }
        result.itemsTipoBackfilled += 1;
      }
    }
  }

  return result;
}
