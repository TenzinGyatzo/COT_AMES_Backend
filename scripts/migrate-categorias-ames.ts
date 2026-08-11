/**
 * Story 5.4 / AD-24 — Migración one-shot AMES QRO + LM → categorías dinámicas.
 *
 * Orden ops: backup Mongo → este script → verificar → usar/release hard-cut (5.3).
 * NO corre en onModuleInit. Idempotente. Solo tenants clave queretaro | los-mochis.
 *
 * Uso:
 *   cd backend
 *   npm run migrate:categorias-ames
 *
 * Requiere MONGODB_URI (igual que la app). Ver scripts/README-migrate-categorias-ames.md
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import mongoose, { Types } from 'mongoose';
import { runMigrateCategoriasAmes } from '../src/servicios/migration/migrate-categorias-ames.runner';

/** Carga backend/.env sin dependencia directa de dotenv. */
function loadEnvFile() {
  const envPath = resolve(__dirname, '../.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri?.trim()) {
    console.error('ERROR: MONGODB_URI no definida. Configura backend/.env');
    process.exit(1);
  }

  console.log('Conectando a Mongo…');
  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('sin database handle tras mongoose.connect');
    }

    const tenantsCol = db.collection('tenants');
    const categoriasCol = db.collection('categorias_servicio');
    const serviciosCol = db.collection('servicios');

    const result = await runMigrateCategoriasAmes({
      tenants: {
        find: (filter) => ({
          toArray: () =>
            tenantsCol
              .find(filter)
              .project({ _id: 1, clave: 1, nombre: 1 })
              .toArray() as Promise<
              { _id: Types.ObjectId; clave: string; nombre?: string }[]
            >,
        }),
      },
      categorias: {
        findOneAndUpdate: async (filter, update, options) => {
          const doc = await categoriasCol.findOneAndUpdate(filter, update, {
            upsert: options.upsert,
            returnDocument: options.returnDocument,
          });
          return doc as {
            _id: Types.ObjectId;
            tenantId: Types.ObjectId;
            codigo: string;
            nombre: string;
            activo?: boolean;
          } | null;
        },
      },
      servicios: {
        find: (filter) => ({
          toArray: () =>
            serviciosCol.find(filter).toArray() as Promise<
              {
                _id: Types.ObjectId;
                tenantId: Types.ObjectId;
                categoria?: string;
                categoriaId?: Types.ObjectId;
                tipo?: string;
              }[]
            >,
        }),
        updateOne: (filter, update) => serviciosCol.updateOne(filter, update),
      },
    });

    console.log('\n=== Migración OK ===');
    console.log(`Tenants: ${result.tenantsProcessed.join(', ')}`);
    console.log(`Categorías upsert (ops): ${result.categoriesUpserted}`);
    console.log(`Ítems remapeados: ${result.itemsRemapped}`);
    console.log(`Ítems tipo backfill: ${result.itemsTipoBackfilled}`);
    console.log(`Warnings (→ OTR): ${result.warnings}`);
    console.log(
      '\nRe-run es seguro (idempotente). VDP queda tipo=servicio (Epic 6 = reclasificar a producto).',
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('\nMigración FALLIDA:', err?.message || err);
  process.exit(1);
});
