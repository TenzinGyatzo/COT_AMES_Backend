import { Types } from 'mongoose';
import { CountersService } from './counters.service';

describe('CountersService (Story 6.1 / AD-9)', () => {
  const tenantA = new Types.ObjectId();
  const tenantB = new Types.ObjectId();
  const year = new Date().getFullYear();

  /** In-memory counters store keyed tenantId:year */
  const counterStore = new Map<
    string,
    { tenantId: Types.ObjectId; year: number; seq: number }
  >();
  let cotizacionFolios: { tenantId: Types.ObjectId; folio: string }[] = [];

  function key(tenantId: Types.ObjectId, y: number) {
    return `${tenantId.toString()}:${y}`;
  }

  const counterModel: any = {
    findOne: jest.fn((filter: any) => ({
      select: () => ({
        lean: () => ({
          exec: async () => {
            const k = key(filter.tenantId, filter.year);
            const doc = counterStore.get(k);
            return doc ? { _id: new Types.ObjectId() } : null;
          },
        }),
      }),
    })),
    updateOne: jest.fn((filter: any, update: any) => ({
      exec: async () => {
        const k = key(filter.tenantId, filter.year);
        if (update.$setOnInsert) {
          if (counterStore.has(k)) {
            const err: any = new Error('E11000 duplicate key');
            err.code = 11000;
            throw err;
          }
          counterStore.set(k, {
            tenantId: filter.tenantId,
            year: filter.year,
            seq: update.$setOnInsert.seq ?? 0,
          });
          return { acknowledged: true };
        }
        if (update.$max?.seq != null) {
          const doc = counterStore.get(k);
          if (doc && update.$max.seq > doc.seq) {
            doc.seq = update.$max.seq;
          }
          return { acknowledged: true };
        }
        return { acknowledged: true };
      },
    })),
    findOneAndUpdate: jest.fn((filter: any, update: any) => ({
      exec: async () => {
        const k = key(filter.tenantId, filter.year);
        const doc = counterStore.get(k);
        if (!doc) return null;
        if (update.$inc?.seq) {
          doc.seq += update.$inc.seq;
        }
        return { ...doc };
      },
    })),
  };

  const cotizacionModel: any = {
    find: jest.fn((filter: any) => ({
      select: () => ({
        lean: () => ({
          exec: async () =>
            cotizacionFolios
              .filter(
                (r) =>
                  String(r.tenantId) === String(filter.tenantId) &&
                  (filter.folio?.$regex
                    ? new RegExp(filter.folio.$regex).test(r.folio)
                    : true),
              )
              .map((r) => ({ folio: r.folio })),
        }),
      }),
    })),
  };

  let service: CountersService;

  beforeEach(() => {
    counterStore.clear();
    cotizacionFolios = [];
    jest.clearAllMocks();
    // Restore default findOne after race tests override it
    counterModel.findOne = jest.fn((filter: any) => ({
      select: () => ({
        lean: () => ({
          exec: async () => {
            const k = key(filter.tenantId, filter.year);
            const doc = counterStore.get(k);
            return doc ? { _id: new Types.ObjectId() } : null;
          },
        }),
      }),
    }));
    service = new CountersService(counterModel, cotizacionModel);
  });

  it('maxSeqFromFolioStrings parsea el máximo NNNN del año', () => {
    expect(
      CountersService.maxSeqFromFolioStrings(
        ['COT-2026-0001', 'COT-2026-0005', 'COT-2025-0099', 'basura'],
        2026,
      ),
    ).toBe(5);
    expect(CountersService.maxSeqFromFolioStrings([], 2026)).toBe(0);
  });

  it('nextFolio emite secuencia atómica 0001, 0002, 0003', async () => {
    const f1 = await service.nextFolio(tenantA);
    const f2 = await service.nextFolio(tenantA);
    const f3 = await service.nextFolio(tenantA);
    expect(f1).toBe(`COT-${year}-0001`);
    expect(f2).toBe(`COT-${year}-0002`);
    expect(f3).toBe(`COT-${year}-0003`);
  });

  it('tenants independientes comparten el mismo year sin colisión de seq', async () => {
    const a1 = await service.nextFolio(tenantA);
    const b1 = await service.nextFolio(tenantB);
    const a2 = await service.nextFolio(tenantA);
    expect(a1).toBe(`COT-${year}-0001`);
    expect(b1).toBe(`COT-${year}-0001`);
    expect(a2).toBe(`COT-${year}-0002`);
  });

  it('brownfield: bootstrap desde max folio existente', async () => {
    cotizacionFolios = [
      { tenantId: tenantA, folio: `COT-${year}-0003` },
      { tenantId: tenantA, folio: `COT-${year}-0005` },
      { tenantId: tenantB, folio: `COT-${year}-0099` },
    ];
    const next = await service.nextFolio(tenantA);
    expect(next).toBe(`COT-${year}-0006`);
  });

  it('usa $inc vía findOneAndUpdate (no countDocuments)', async () => {
    await service.nextFolio(tenantA);
    expect(counterModel.findOneAndUpdate).toHaveBeenCalledWith(
      { tenantId: tenantA, year },
      { $inc: { seq: 1 } },
      { new: true },
    );
  });

  it('carrera upsert: ignora E11000 y $max alinea seq bajo del peer', async () => {
    cotizacionFolios = [
      { tenantId: tenantA, folio: `COT-${year}-0005` },
    ];
    // Peer insertó entre findOne y upsert con seq stale (2 < max brownfield 5)
    counterModel.findOne = jest.fn((filter: any) => ({
      select: () => ({
        lean: () => ({
          exec: async () => {
            counterStore.set(key(filter.tenantId, filter.year), {
              tenantId: filter.tenantId,
              year: filter.year,
              seq: 2,
            });
            return null;
          },
        }),
      }),
    }));

    const next = await service.nextFolio(tenantA);
    expect(next).toBe(`COT-${year}-0006`);
    expect(counterStore.get(key(tenantA, year))?.seq).toBe(6);
  });
});
