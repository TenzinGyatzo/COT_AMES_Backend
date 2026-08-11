import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PlantillasService } from './plantillas.service';
import { TenantContextService } from '../tenants/tenant-context.service';
import {
  CLAVE_SEED_ADMINISTRATIVOS,
  CLAVE_SEED_COMERCIALES,
  PLANTILLAS_SEED,
} from './constants/plantillas-seed';

describe('PlantillasService (Story 5.1 + 5.2)', () => {
  const tenantQro = { _id: new Types.ObjectId(), clave: 'queretaro' };
  const otherTenantId = new Types.ObjectId();

  /** key = `${tenantId}:${claveSeed}` for seeds; also by _id for CRUD */
  const store = new Map<string, any>();
  const byId = new Map<string, any>();

  function storeKey(tenantId: Types.ObjectId, claveSeed: string) {
    return `${tenantId.toString()}:${claveSeed}`;
  }

  function indexDoc(doc: any) {
    byId.set(doc._id.toString(), doc);
    if (doc.claveSeed) {
      store.set(storeKey(doc.tenantId, doc.claveSeed), doc);
    }
  }

  const plantillaModel: any = jest.fn().mockImplementation((data: any) => {
    const doc = {
      ...data,
      _id: new Types.ObjectId(),
      save: jest.fn().mockImplementation(async function (this: any) {
        indexDoc(this);
        return this;
      }),
    };
    return doc;
  });

  function mockSeedUpsert() {
    plantillaModel.findOneAndUpdate = jest.fn(
      (filter: any, update: any, opts?: any) => ({
        exec: async () => {
          // Seed path: { tenantId, claveSeed }
          if (filter.claveSeed) {
            const key = storeKey(filter.tenantId, filter.claveSeed);
            const existing = store.get(key);
            if (existing) {
              if (update.$set) Object.assign(existing, update.$set);
              return existing;
            }
            const doc = {
              _id: new Types.ObjectId(),
              ...(update.$setOnInsert || {}),
              ...(update.$set || {}),
            };
            indexDoc(doc);
            return doc;
          }
          // Update/remove path: { _id, tenantId }
          const id = String(filter._id);
          const existing = byId.get(id);
          if (
            !existing ||
            existing.tenantId.toString() !== filter.tenantId.toString()
          ) {
            return null;
          }
          if (update.$set) Object.assign(existing, update.$set);
          return opts?.new === false ? existing : existing;
        },
      }),
    );
  }

  mockSeedUpsert();

  plantillaModel.find = jest.fn((q: Record<string, any>) => {
    let skipN = 0;
    let limitN = Number.MAX_SAFE_INTEGER;
    const chain = {
      sort: () => chain,
      skip: (n: number) => {
        skipN = n;
        return chain;
      },
      limit: (n: number) => {
        limitN = n;
        return chain;
      },
      exec: async () => {
        let rows = [...byId.values()].filter(
          (d) => d.tenantId?.toString() === q.tenantId.toString(),
        );
        if (q.activo?.$ne === false) {
          rows = rows.filter((d) => d.activo !== false);
        } else if (q.activo === false) {
          rows = rows.filter((d) => d.activo === false);
        }
        if (q.nombre?.$regex) {
          const re = new RegExp(q.nombre.$regex, q.nombre.$options || 'i');
          rows = rows.filter((d) => re.test(d.nombre));
        }
        rows.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
        return rows.slice(skipN, skipN + limitN);
      },
    };
    return chain;
  });

  plantillaModel.countDocuments = jest.fn((q: Record<string, any>) => ({
    exec: async () => {
      // Count without skip/limit — mirror Mongo countDocuments
      let rows = [...byId.values()].filter(
        (d) => d.tenantId?.toString() === q.tenantId.toString(),
      );
      if (q.activo?.$ne === false) {
        rows = rows.filter((d) => d.activo !== false);
      } else if (q.activo === false) {
        rows = rows.filter((d) => d.activo === false);
      }
      if (q.nombre?.$regex) {
        const re = new RegExp(q.nombre.$regex, q.nombre.$options || 'i');
        rows = rows.filter((d) => re.test(d.nombre));
      }
      return rows.length;
    },
  }));

  plantillaModel.findOne = jest.fn((q: Record<string, any>) => ({
    exec: async () => {
      if (q.claveSeed) {
        return store.get(storeKey(q.tenantId, q.claveSeed)) || null;
      }
      const doc = byId.get(String(q._id));
      if (!doc || doc.tenantId.toString() !== q.tenantId.toString()) {
        return null;
      }
      return {
        ...doc,
        save: jest.fn().mockImplementation(async function (this: any) {
          indexDoc({ ...this });
          return this;
        }),
      };
    },
  }));

  const tenantContext = {
    getTenantId: jest.fn().mockReturnValue(tenantQro._id),
  } as unknown as TenantContextService;

  const service = new PlantillasService(plantillaModel, tenantContext);

  const seccionOk = {
    id: 's1',
    tipo: 'richtext' as const,
    cuerpo: { text: 'Hola' },
  };

  beforeEach(() => {
    store.clear();
    byId.clear();
    jest.clearAllMocks();
    mockSeedUpsert();
    (tenantContext.getTenantId as jest.Mock).mockReturnValue(tenantQro._id);
    plantillaModel.mockClear();
  });

  it('ensureSeededForTenant (Story 4.1) siembra plantillas del tenant', async () => {
    const docs = await service.ensureSeededForTenant(tenantQro._id);
    expect(docs).toHaveLength(PLANTILLAS_SEED.length);
    expect(store.size).toBe(2);

    const nombres = [...store.values()].map((d) => d.nombre).sort();
    expect(nombres).toEqual([
      'Requerimientos Administrativos',
      'Requerimientos Comerciales',
    ]);

    for (const d of store.values()) {
      expect(String(d.tenantId)).toBe(String(tenantQro._id));
      expect(d.schemaVersion).toBe(1);
      expect(d.activo).not.toBe(false);
      expect(d.isSystem).toBeUndefined();
      expect(d.secciones?.length).toBeGreaterThan(0);
      expect([CLAVE_SEED_COMERCIALES, CLAVE_SEED_ADMINISTRATIVOS]).toContain(
        d.claveSeed,
      );
    }
  });

  it('ensureSeededForTenant (Story 4.1) siembra tenant fuera de INITIAL_TENANTS', async () => {
    const docs = await service.ensureSeededForTenant(otherTenantId);
    expect(docs).toHaveLength(PLANTILLAS_SEED.length);
    expect(store.size).toBe(2);
    for (const d of docs) {
      expect(String((d as any).tenantId)).toBe(String(otherTenantId));
    }
  });

  it('ensureSeededForTenant es idempotente', async () => {
    const first = await service.ensureSeededForTenant(otherTenantId);
    const second = await service.ensureSeededForTenant(otherTenantId);
    expect(store.size).toBe(2);
    expect(second.map((d: any) => String(d._id)).sort()).toEqual(
      first.map((d: any) => String(d._id)).sort(),
    );
  });

  it('ensureSeededForTenant recupera tras E11000 en upsert concurrente', async () => {
    const existing = {
      _id: new Types.ObjectId(),
      tenantId: otherTenantId,
      claveSeed: CLAVE_SEED_COMERCIALES,
      nombre: 'Ya existía',
    };
    indexDoc(existing);

    const dup: any = new Error('E11000 duplicate key');
    dup.code = 11000;

    let calls = 0;
    plantillaModel.findOneAndUpdate = jest.fn(
      (filter: any, update: any, opts?: any) => ({
        exec: async () => {
          calls += 1;
          if (filter.claveSeed === CLAVE_SEED_COMERCIALES && calls === 1) {
            throw dup;
          }
          const key = storeKey(filter.tenantId, filter.claveSeed);
          const found = store.get(key);
          if (found) return found;
          const doc = {
            _id: new Types.ObjectId(),
            ...(update.$setOnInsert || {}),
            ...(update.$set || {}),
          };
          indexDoc(doc);
          return doc;
        },
      }),
    );

    const docs = await service.ensureSeededForTenant(otherTenantId);
    expect(docs).toHaveLength(PLANTILLAS_SEED.length);
    expect(docs.some((d: any) => String(d._id) === String(existing._id))).toBe(
      true,
    );

    mockSeedUpsert();
  });

  it('re-seed no pisa secciones ni activo editados', async () => {
    await service.ensureSeededForTenant(tenantQro._id);
    const key = storeKey(tenantQro._id, CLAVE_SEED_COMERCIALES);
    const doc = store.get(key);
    doc.activo = false;
    doc.secciones = [
      {
        id: 'custom',
        tipo: 'richtext',
        cuerpo: { text: 'Editado por usuario' },
      },
    ];
    doc.nombre = 'Nombre editado';

    await service.ensureSeededForTenant(tenantQro._id);

    const after = store.get(key);
    expect(after.activo).toBe(false);
    expect(after.nombre).toBe('Nombre editado');
    expect(after.secciones[0].cuerpo.text).toBe('Editado por usuario');
  });

  it('create permite plantilla adicional sin claveSeed', async () => {
    const created = await service.create({
      nombre: '  Custom  ',
      secciones: [seccionOk],
    });

    expect(created.nombre).toBe('Custom');
    expect(created.claveSeed).toBeUndefined();
    expect(created.schemaVersion).toBe(1);
    expect(created.activo).toBe(true);
    expect(tenantContext.getTenantId).toHaveBeenCalled();
  });

  it('create rechaza nombre vacío', async () => {
    await expect(
      service.create({
        nombre: '   ',
        secciones: [seccionOk],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create rechaza secciones vacías o inválidas', async () => {
    await expect(
      service.create({ nombre: 'X', secciones: [] as any }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create({
        nombre: 'X',
        secciones: [{ id: '1', tipo: 'richtext' } as any],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create acepta cuerpo.doc TipTap y rechaza doc inválido o incoherente', async () => {
    const docHola = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hola' }],
        },
      ],
    };
    const created = await service.create({
      nombre: 'Con doc',
      secciones: [
        {
          id: 'r1',
          tipo: 'richtext',
          cuerpo: {
            text: 'Hola',
            doc: docHola,
          },
        },
      ],
    });
    expect((created.secciones[0] as any).cuerpo.doc).toEqual(docHola);

    await expect(
      service.create({
        nombre: 'Bad doc',
        secciones: [
          {
            id: 'r2',
            tipo: 'richtext',
            cuerpo: { text: 'x', doc: ['no-object'] as any },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create({
        nombre: 'Mismatch',
        secciones: [
          {
            id: 'r3',
            tipo: 'richtext',
            cuerpo: {
              text: 'Otro',
              doc: docHola,
            },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update acepta cuerpo.doc TipTap y rechaza doc inválido', async () => {
    await service.ensureSeededForTenant(tenantQro._id);
    const key = storeKey(tenantQro._id, CLAVE_SEED_COMERCIALES);
    const seeded = store.get(key);
    const docOk = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Actualizado' }],
        },
      ],
    };

    const updated = await service.update(seeded._id.toString(), {
      secciones: [
        {
          id: 'u1',
          tipo: 'richtext',
          cuerpo: { text: 'Actualizado', doc: docOk },
        },
      ],
    });
    expect((updated.secciones[0] as any).cuerpo.doc).toEqual(docOk);
    expect((updated.secciones[0] as any).cuerpo.text).toBe('Actualizado');

    await expect(
      service.update(seeded._id.toString(), {
        secciones: [
          {
            id: 'u2',
            tipo: 'richtext',
            cuerpo: { text: 'x', doc: null as any },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create rechaza ids de sección duplicados', async () => {
    await expect(
      service.create({
        nombre: 'Dup ids',
        secciones: [
          { id: 'mismo', tipo: 'richtext', cuerpo: { text: 'a' } },
          { id: 'mismo', tipo: 'richtext', cuerpo: { text: 'b' } },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create rechaza filas mal tipadas o con ancho distinto a encabezados', async () => {
    await expect(
      service.create({
        nombre: 'Bad filas',
        secciones: [
          {
            id: 't1',
            tipo: 'tabla',
            encabezados: ['A', 'B'],
            filas: [['solo-una']],
          } as any,
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create({
        nombre: 'Bad cells',
        secciones: [
          {
            id: 't2',
            tipo: 'tabla',
            encabezados: ['A'],
            filas: [[1 as unknown as string]],
          } as any,
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findAll pagina y filtra por tenant + activo default', async () => {
    await service.ensureSeededForTenant(tenantQro._id);
    // inactive one
    const key = storeKey(tenantQro._id, CLAVE_SEED_COMERCIALES);
    store.get(key).activo = false;

    const res = await service.findAll({ page: 1, limit: 20 });
    expect(res.total).toBe(1); // only admin seed still active for QRO
    expect(res.data).toHaveLength(1);
    expect(res.page).toBe(1);
    expect(res.totalPages).toBe(1);

    const inactive = await service.findAll({ activo: false });
    expect(inactive.total).toBe(1);
    expect((inactive.data[0] as any).claveSeed).toBe(CLAVE_SEED_COMERCIALES);
  });

  it('findAll aplica skip/limit reales', async () => {
    await service.ensureSeededForTenant(tenantQro._id);
    await service.create({ nombre: 'Alpha custom', secciones: [seccionOk] });
    await service.create({ nombre: 'Zeta custom', secciones: [seccionOk] });

    const page1 = await service.findAll({ page: 1, limit: 2 });
    expect(page1.total).toBeGreaterThanOrEqual(4);
    expect(page1.data).toHaveLength(2);
    expect(page1.limit).toBe(2);
    expect(page1.totalPages).toBeGreaterThanOrEqual(2);

    const page2 = await service.findAll({ page: 2, limit: 2 });
    expect(page2.data.length).toBeGreaterThan(0);
    const ids1 = page1.data.map((d: any) => d._id.toString());
    const ids2 = page2.data.map((d: any) => d._id.toString());
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it('findAll filtra por nombre', async () => {
    await service.ensureSeededForTenant(tenantQro._id);
    const res = await service.findAll({ nombre: 'admin' });
    expect(res.total).toBe(1);
    expect((res.data[0] as any).nombre).toContain('Administrativos');
  });

  it('update y softDelete (remove) funcionan sobre seed sin locked', async () => {
    await service.ensureSeededForTenant(tenantQro._id);
    const key = storeKey(tenantQro._id, CLAVE_SEED_ADMINISTRATIVOS);
    const seeded = store.get(key);

    const updated = await service.update(seeded._id.toString(), {
      nombre: 'Admin editada',
    });
    expect(updated.nombre).toBe('Admin editada');
    expect(updated.claveSeed).toBe(CLAVE_SEED_ADMINISTRATIVOS);

    const deleted = await service.remove(seeded._id.toString());
    expect(deleted.activo).toBe(false);
  });

  it('findOne cross-tenant → NotFoundException', async () => {
    await service.ensureSeededForTenant(tenantQro._id);
    const key = storeKey(tenantQro._id, CLAVE_SEED_COMERCIALES);
    const seeded = store.get(key);

    (tenantContext.getTenantId as jest.Mock).mockReturnValue(otherTenantId);
    await expect(service.findOne(seeded._id.toString())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update not found → NotFoundException', async () => {
    await expect(
      service.update(new Types.ObjectId().toString(), { nombre: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update rechaza nombre null (no TypeError)', async () => {
    await expect(
      service.update(new Types.ObjectId().toString(), {
        nombre: null as unknown as string,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('toggleActivo invierte activo sin locked', async () => {
    await service.ensureSeededForTenant(tenantQro._id);
    const key = storeKey(tenantQro._id, CLAVE_SEED_COMERCIALES);
    const seeded = store.get(key);
    expect(seeded.activo).not.toBe(false);

    const toggledOff = await service.toggleActivo(seeded._id.toString());
    expect(toggledOff.activo).toBe(false);

    const toggledOn = await service.toggleActivo(seeded._id.toString());
    expect(toggledOn.activo).toBe(true);
  });
});
