import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TenantsService, INITIAL_TENANTS } from './tenants.service';
import { Tenant } from './schemas/tenant.schema';

describe('TenantsService', () => {
  let service: TenantsService;
  const store = new Map<string, any>();

  const mockModel: any = {
    findOneAndUpdate: jest.fn(
      (filter: { clave: string }, update: any, opts: any) => ({
        exec: async () => {
          const existing = store.get(filter.clave);
          if (existing) {
            Object.assign(existing, update.$set || {});
            return existing;
          }
          const doc = {
            _id: `id-${filter.clave}`,
            ...update.$setOnInsert,
            ...update.$set,
          };
          store.set(filter.clave, doc);
          return doc;
        },
      }),
    ),
    find: jest.fn(() => ({
      sort: () => ({
        exec: async () => Array.from(store.values()),
      }),
    })),
    findOne: jest.fn((q: { clave: string }) => ({
      exec: async () => store.get(q.clave) || null,
    })),
  };

  beforeEach(async () => {
    store.clear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: getModelToken(Tenant.name), useValue: mockModel },
      ],
    }).compile();

    service = module.get(TenantsService);
    jest.clearAllMocks();
  });

  it('ensureSeeded es idempotente (2 llamadas → mismos 2 tenants)', async () => {
    const first = await service.ensureSeeded();
    const second = await service.ensureSeeded();

    expect(first).toHaveLength(INITIAL_TENANTS.length);
    expect(second).toHaveLength(INITIAL_TENANTS.length);
    expect(store.size).toBe(2);
    expect([...store.keys()].sort()).toEqual(['los-mochis', 'queretaro']);
    expect(mockModel.findOneAndUpdate).toHaveBeenCalledTimes(
      INITIAL_TENANTS.length * 2,
    );
  });
});
