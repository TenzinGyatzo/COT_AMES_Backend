import { Types } from 'mongoose';
import { MetricsService } from './metrics.service';

describe('MetricsService (Story 7.1 / 7.2)', () => {
  const tenantA = new Types.ObjectId();
  const tenantB = new Types.ObjectId();

  let countCalls: any[];
  let aggregatePipelines: any[];
  let ModelCtor: any;
  let tenantContext: { getTenantId: jest.Mock };
  let service: MetricsService;

  beforeEach(() => {
    countCalls = [];
    aggregatePipelines = [];
    tenantContext = {
      getTenantId: jest.fn().mockReturnValue(tenantA),
    };
    ModelCtor = {
      countDocuments: jest.fn().mockImplementation(async (filter: any) => {
        countCalls.push(filter);
        if (filter?.estado === 'aceptada') return 4;
        if (filter?.estado === 'rechazada') return 2;
        return 10;
      }),
      aggregate: jest.fn().mockImplementation((pipeline: any[]) => {
        aggregatePipelines.push(pipeline);
        return { exec: jest.fn().mockResolvedValue([]) };
      }),
    };
    service = new MetricsService(ModelCtor as any, tenantContext as any);
  });

  it('buildMatch / totals siempre incluyen tenantId del contexto', async () => {
    const totals = await service.getTotalsMetrics();
    expect(tenantContext.getTenantId).toHaveBeenCalled();
    expect(countCalls.length).toBeGreaterThan(0);
    for (const filter of countCalls) {
      expect(String(filter.tenantId)).toBe(String(tenantA));
    }
    expect(totals.cotizacionesEmitidas).toBe(10);
    expect(totals.cotizacionesAceptadas).toBe(4);
    expect(totals.cotizacionesRechazadas).toBe(2);
    expect(totals.cotizacionesTotales).toBe(10);
    expect(totals.tasaConversion).toBeCloseTo(0.4);
  });

  it('filtro fecha acota fechaCreacion en emitidas, aceptadas y rechazadas', async () => {
    await service.getTotalsMetrics({
      fechaDesde: '2026-01-01T00:00:00.000Z',
      fechaHasta: '2026-06-30T23:59:59.000Z',
    });
    const desde = new Date('2026-01-01T00:00:00.000Z').getTime();
    const hasta = new Date('2026-06-30T23:59:59.000Z').getTime();

    const emitidasFilter = countCalls.find(
      (f) =>
        !f.estado &&
        f.fechaCreacion?.$gte?.getTime() === desde &&
        f.fechaCreacion?.$lte?.getTime() === hasta &&
        !f.fechaCreacion?.$lt,
    );
    expect(emitidasFilter).toBeDefined();
    expect(String(emitidasFilter.tenantId)).toBe(String(tenantA));

    for (const estado of ['aceptada', 'rechazada'] as const) {
      const estadoFilter = countCalls.find(
        (f) =>
          f.estado === estado &&
          f.fechaCreacion?.$gte?.getTime() === desde &&
          f.fechaCreacion?.$lte?.getTime() === hasta,
      );
      expect(estadoFilter).toBeDefined();
      expect(String(estadoFilter.tenantId)).toBe(String(tenantA));
    }
  });

  it('withMatch: fechaDesde posterior a startOfDay no ensancha Hoy hacia atrás', async () => {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    await service.getTotalsMetrics({
      fechaDesde: tomorrow.toISOString(),
    });

    const hoyFilter = countCalls.find(
      (f) => !f.estado && f.fechaCreacion?.$lt instanceof Date,
    );
    expect(hoyFilter).toBeDefined();
    // Intersección: gana el $gte más tardío (usuario), no startOfDay
    expect(hoyFilter.fechaCreacion.$gte.getTime()).toBe(tomorrow.getTime());
    expect(hoyFilter.fechaCreacion.$gte.getTime()).not.toBe(
      startOfToday.getTime(),
    );
  });

  it('withMatch: fechaDesde anterior a Hoy no ensancha hacia atrás', async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setHours(0, 0, 0, 0);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    await service.getTotalsMetrics({
      fechaDesde: threeDaysAgo.toISOString(),
    });

    const hoyFilter = countCalls.find(
      (f) => !f.estado && f.fechaCreacion?.$lt instanceof Date,
    );
    expect(hoyFilter).toBeDefined();
    expect(hoyFilter.fechaCreacion.$gte.getTime()).toBe(startOfToday.getTime());
  });

  it('Hoy usa $lt fin de día (no cuenta fechas futuras indefinidas)', async () => {
    await service.getTotalsMetrics();
    const hoyFilter = countCalls.find(
      (f) => !f.estado && f.fechaCreacion?.$lt instanceof Date,
    );
    expect(hoyFilter).toBeDefined();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    expect(hoyFilter.fechaCreacion.$gte.getTime()).toBe(start.getTime());
    expect(hoyFilter.fechaCreacion.$lt.getTime()).toBe(end.getTime());
  });

  it('tasaConversion 0 si emitidas = 0', async () => {
    ModelCtor.countDocuments.mockResolvedValue(0);
    const totals = await service.getTotalsMetrics();
    expect(totals.cotizacionesEmitidas).toBe(0);
    expect(totals.tasaConversion).toBe(0);
  });

  it('aislamiento: tenant B no usa tenant A en match', async () => {
    tenantContext.getTenantId.mockReturnValue(tenantB);
    await service.getClientsMetrics();
    const pipeline = aggregatePipelines[0];
    const firstMatch = pipeline.find((s: any) => s.$match?.tenantId);
    expect(String(firstMatch.$match.tenantId)).toBe(String(tenantB));
    expect(String(firstMatch.$match.tenantId)).not.toBe(String(tenantA));
  });

  it('lookup clientes incluye match de tenantId', async () => {
    await service.getClientsMetrics();
    const pipeline = aggregatePipelines[0];
    const lookup = pipeline.find((s: any) => s.$lookup?.from === 'clientes');
    expect(lookup.$lookup.pipeline).toBeDefined();
    const lookupMatch = lookup.$lookup.pipeline[0].$match.$expr.$and;
    expect(lookupMatch).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          $eq: ['$tenantId', tenantA],
        }),
      ]),
    );
  });

  describe('Story 7.2 — cambio de contexto admin (selector → nuevo tenantId)', () => {
    it('al cambiar getTenantId A→B, totals solo usa B (no mezcla A)', async () => {
      await service.getTotalsMetrics();
      expect(countCalls.every((f) => String(f.tenantId) === String(tenantA))).toBe(
        true,
      );

      countCalls.length = 0;
      tenantContext.getTenantId.mockReturnValue(tenantB);
      await service.getTotalsMetrics();

      expect(countCalls.length).toBeGreaterThan(0);
      for (const filter of countCalls) {
        expect(String(filter.tenantId)).toBe(String(tenantB));
        expect(String(filter.tenantId)).not.toBe(String(tenantA));
      }
    });

    it('clients / services / totals tras cambio de contexto usan solo tenant B', async () => {
      tenantContext.getTenantId.mockReturnValue(tenantB);
      await Promise.all([
        service.getClientsMetrics(),
        service.getServicesMetrics(),
        service.getTotalsMetrics(),
      ]);

      for (const filter of countCalls) {
        expect(String(filter.tenantId)).toBe(String(tenantB));
      }
      for (const pipeline of aggregatePipelines) {
        const firstMatch = pipeline.find((s: any) => s.$match?.tenantId);
        expect(firstMatch).toBeDefined();
        expect(String(firstMatch.$match.tenantId)).toBe(String(tenantB));
        expect(String(firstMatch.$match.tenantId)).not.toBe(String(tenantA));
      }
    });

    it('métricas no agregan por userId ni creadoPor*', async () => {
      await service.getTotalsMetrics();
      await service.getClientsMetrics();
      await service.getServicesMetrics();

      for (const filter of countCalls) {
        expect(filter).not.toHaveProperty('userId');
        expect(filter).not.toHaveProperty('creadoPorUserId');
        expect(filter).not.toHaveProperty('creadoPorEmail');
      }
      const serialized = JSON.stringify(aggregatePipelines);
      expect(serialized).not.toMatch(/creadoPor/);
      expect(serialized).not.toMatch(/"userId"/);
    });
  });
});
