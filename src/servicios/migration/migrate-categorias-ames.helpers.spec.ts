import { Types } from 'mongoose';
import {
  AMES_TENANT_CLAVES,
  SEED_CATEGORIAS,
  itemNeedsCategoriaRemap,
  itemNeedsTipoBackfill,
  normalizeCategoriaCodigo,
  resolveSeedCodigo,
} from './migrate-categorias-ames.helpers';
import {
  runMigrateCategoriasAmes,
  type CategoriaDoc,
  type ServicioDoc,
  type TenantDoc,
} from './migrate-categorias-ames.runner';

describe('migrate-categorias-ames helpers', () => {
  it('normaliza codigo a uppercase y trim', () => {
    expect(normalizeCategoriaCodigo('  med  ')).toBe('MED');
    expect(normalizeCategoriaCodigo('')).toBeNull();
    expect(normalizeCategoriaCodigo(null)).toBeNull();
  });

  it('resolveSeedCodigo mapea conocidos y unknown/vacío → OTR', () => {
    expect(resolveSeedCodigo('med')).toEqual({
      codigo: 'MED',
      usedFallback: false,
    });
    expect(resolveSeedCodigo('VDP')).toEqual({
      codigo: 'VDP',
      usedFallback: false,
    });
    expect(resolveSeedCodigo('XYZ')).toEqual({
      codigo: 'OTR',
      usedFallback: true,
    });
    expect(resolveSeedCodigo('')).toEqual({
      codigo: 'OTR',
      usedFallback: true,
    });
    expect(resolveSeedCodigo(undefined)).toEqual({
      codigo: 'OTR',
      usedFallback: true,
    });
  });

  it('itemNeedsCategoriaRemap / tipo backfill', () => {
    expect(itemNeedsCategoriaRemap({ categoria: 'MED' })).toBe(true);
    expect(itemNeedsCategoriaRemap({ categoriaId: undefined })).toBe(true);
    expect(
      itemNeedsCategoriaRemap({
        categoriaId: new Types.ObjectId(),
      }),
    ).toBe(false);
    expect(
      itemNeedsTipoBackfill({
        categoriaId: new Types.ObjectId(),
      }),
    ).toBe(true);
    expect(
      itemNeedsTipoBackfill({
        categoriaId: new Types.ObjectId(),
        tipo: 'servicio',
      }),
    ).toBe(false);
    expect(
      itemNeedsTipoBackfill({
        categoriaId: new Types.ObjectId(),
        tipo: '   ',
      }),
    ).toBe(true);
    expect(
      itemNeedsTipoBackfill({
        categoriaId: new Types.ObjectId(),
        tipo: 1 as unknown as string,
      }),
    ).toBe(true);
  });

  it('SEED tiene 8 códigos AMES canónicos', () => {
    expect(SEED_CATEGORIAS).toHaveLength(8);
    expect(SEED_CATEGORIAS.map((c) => c.codigo)).toEqual([
      'MED',
      'SH',
      'CAP',
      'PC',
      'EAL',
      'RME',
      'VDP',
      'OTR',
    ]);
    expect(AMES_TENANT_CLAVES).toEqual(['queretaro', 'los-mochis']);
  });
});

describe('runMigrateCategoriasAmes', () => {
  const qroId = new Types.ObjectId();
  const lmId = new Types.ObjectId();
  const otherTenantId = new Types.ObjectId();
  const medIdQro = new Types.ObjectId();
  const otrIdQro = new Types.ObjectId();

  function buildDeps(opts?: {
    tenants?: TenantDoc[];
    existingMed?: CategoriaDoc;
    items?: ServicioDoc[];
  }) {
    const tenants: TenantDoc[] = opts?.tenants ?? [
      { _id: qroId, clave: 'queretaro', nombre: 'Querétaro' },
      { _id: lmId, clave: 'los-mochis', nombre: 'Los Mochis' },
    ];

    const catStore = new Map<string, CategoriaDoc>();
    if (opts?.existingMed) {
      catStore.set(
        `${opts.existingMed.tenantId}:${opts.existingMed.codigo}`,
        opts.existingMed,
      );
    }

    const items = opts?.items ?? [];
    const updates: Array<{
      id: string;
      update: Record<string, unknown>;
    }> = [];
    const catUpserts: string[] = [];

    const deps = {
      tenants: {
        find: () => ({
          toArray: async () => tenants,
        }),
      },
      categorias: {
        findOneAndUpdate: async (
          filter: { tenantId: Types.ObjectId; codigo: string },
          update: Record<string, unknown>,
          _opts: { upsert: boolean; returnDocument: 'after' },
        ) => {
          const key = `${filter.tenantId}:${filter.codigo}`;
          catUpserts.push(key);
          const existing = catStore.get(key);
          if (existing) {
            existing.activo = true;
            return existing;
          }
          const setOnInsert = update.$setOnInsert as {
            nombre: string;
            tenantId: Types.ObjectId;
            codigo: string;
            activo: boolean;
          };
          const created: CategoriaDoc = {
            _id:
              filter.codigo === 'MED' && filter.tenantId.equals(qroId)
                ? medIdQro
                : filter.codigo === 'OTR' && filter.tenantId.equals(qroId)
                  ? otrIdQro
                  : new Types.ObjectId(),
            tenantId: setOnInsert.tenantId,
            codigo: setOnInsert.codigo,
            nombre: setOnInsert.nombre,
            activo: true,
          };
          catStore.set(key, created);
          return created;
        },
      },
      servicios: {
        find: (filter: Record<string, unknown>) => ({
          toArray: async () =>
            items.filter((i) =>
              (filter.tenantId as Types.ObjectId).equals(i.tenantId),
            ),
        }),
        updateOne: async (
          filter: { _id: Types.ObjectId },
          update: Record<string, unknown>,
        ) => {
          updates.push({ id: String(filter._id), update });
          return { matchedCount: 1 };
        },
      },
      log: { info: () => undefined, warn: () => undefined },
      _updates: updates,
      _catUpserts: catUpserts,
      _catStore: catStore,
    };
    return deps;
  }

  it('aborta si falta un tenant AMES', async () => {
    const deps = buildDeps({
      tenants: [{ _id: qroId, clave: 'queretaro', nombre: 'Querétaro' }],
    });
    await expect(runMigrateCategoriasAmes(deps)).rejects.toThrow(
      /Faltan tenants AMES/,
    );
  });

  it('reusa _id de categoría MED ya creada por CRUD (idempotente)', async () => {
    const existingMed: CategoriaDoc = {
      _id: medIdQro,
      tenantId: qroId,
      codigo: 'MED',
      nombre: 'Médicos custom',
      activo: false,
    };
    const deps = buildDeps({ existingMed });
    await runMigrateCategoriasAmes(deps);
    const after = deps._catStore.get(`${qroId}:MED`);
    expect(after?._id).toEqual(medIdQro);
    expect(after?.nombre).toBe('Médicos custom'); // no overwrite
    expect(after?.activo).toBe(true);
  });

  it('remapea categoria lowercase/desconocida → OTR y $unset', async () => {
    const itemMed = {
      _id: new Types.ObjectId(),
      tenantId: qroId,
      categoria: 'med',
    };
    const itemUnknown = {
      _id: new Types.ObjectId(),
      tenantId: qroId,
      categoria: 'XYZ',
    };
    const deps = buildDeps({ items: [itemMed, itemUnknown] });
    const res = await runMigrateCategoriasAmes(deps);

    expect(res.itemsRemapped).toBe(2);
    expect(res.warnings).toBe(1);

    const uMed = deps._updates.find((u) => u.id === String(itemMed._id));
    expect(uMed?.update).toMatchObject({
      $set: { categoriaId: medIdQro, tipo: 'servicio' },
      $unset: { categoria: '' },
    });

    const uOtr = deps._updates.find((u) => u.id === String(itemUnknown._id));
    expect(uOtr?.update).toMatchObject({
      $set: { categoriaId: otrIdQro, tipo: 'servicio' },
      $unset: { categoria: '' },
    });
  });

  it('no toca ítems de tenant no-AMES', async () => {
    const foreign = {
      _id: new Types.ObjectId(),
      tenantId: otherTenantId,
      categoria: 'MED',
    };
    const deps = buildDeps({ items: [foreign] });
    const res = await runMigrateCategoriasAmes(deps);
    expect(res.itemsRemapped).toBe(0);
    expect(deps._updates).toHaveLength(0);
  });

  it('backfill tipo=servicio si ya hay categoriaId', async () => {
    const item = {
      _id: new Types.ObjectId(),
      tenantId: qroId,
      categoriaId: medIdQro,
    };
    const deps = buildDeps({
      existingMed: {
        _id: medIdQro,
        tenantId: qroId,
        codigo: 'MED',
        nombre: 'Médicos',
        activo: true,
      },
      items: [item],
    });
    const res = await runMigrateCategoriasAmes(deps);
    expect(res.itemsTipoBackfilled).toBe(1);
    expect(deps._updates[0].update).toEqual({
      $set: { tipo: 'servicio' },
    });
  });
});
