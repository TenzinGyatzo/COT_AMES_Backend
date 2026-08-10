import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { TenantsService, INITIAL_TENANTS } from './tenants.service';
import { Tenant } from './schemas/tenant.schema';
import { TenantConfigService } from './tenant-config.service';
import { UsersService } from '../users/users.service';
import { PlantillasService } from '../plantillas/plantillas.service';
import { Roles } from '../auth/enums/roles.enum';
import { PLANTILLAS_SEED } from '../plantillas/constants/plantillas-seed';

describe('TenantsService', () => {
  let service: TenantsService;
  const store = new Map<string, any>();

  const mockModel: any = {
    findOneAndUpdate: jest.fn(
      (filter: { clave: string }, update: any) => ({
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
    find: jest.fn(() => {
      const chain: any = {
        sort: () => chain,
        select: () => chain,
        lean: () => chain,
        exec: async () => Array.from(store.values()),
      };
      return chain;
    }),
    findOne: jest.fn((q: { clave: string }) => ({
      exec: async () => store.get(q.clave) || null,
    })),
    findById: jest.fn((id: string) => ({
      exec: async () =>
        [...store.values()].find((d) => String(d._id) === String(id)) || null,
    })),
    findByIdAndUpdate: jest.fn((id: any, update: any) => {
      const resolve = async () => {
        const doc = [...store.values()].find(
          (d) => String(d._id) === String(id),
        );
        if (!doc) return null;
        Object.assign(doc, update.$set || {});
        return doc;
      };
      const chain: any = {
        select: () => chain,
        lean: () => chain,
        exec: resolve,
      };
      return chain;
    }),
    deleteOne: jest.fn((q: { _id: any }) => ({
      exec: async () => {
        for (const [k, v] of [...store.entries()]) {
          if (String(v._id) === String(q._id)) {
            store.delete(k);
            return { deletedCount: 1 };
          }
        }
        return { deletedCount: 0 };
      },
    })),
  };

  // Constructor form for `new this.tenantModel(...)`
  function TenantModelCtor(this: any, data: any) {
    Object.assign(this, data);
    this._id = data._id || new Types.ObjectId();
    this.save = jest.fn().mockImplementation(async () => {
      if (store.has(this.clave)) {
        const err: any = new Error('dup');
        err.code = 11000;
        throw err;
      }
      store.set(this.clave, {
        _id: this._id,
        nombre: this.nombre,
        clave: this.clave,
        activo: this.activo,
      });
      return store.get(this.clave);
    });
  }
  Object.assign(TenantModelCtor, mockModel);

  const tenantConfigService = {
    findOrCreateForTenant: jest.fn().mockResolvedValue({}),
    deleteByTenantId: jest.fn().mockResolvedValue(undefined),
  };
  const usersService = {
    create: jest.fn(),
  };
  const plantillasService = {
    ensureSeededForTenant: jest.fn().mockResolvedValue(
      PLANTILLAS_SEED.map((s) => ({ claveSeed: s.claveSeed })),
    ),
    deleteAllForTenant: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    store.clear();
    jest.clearAllMocks();
    tenantConfigService.findOrCreateForTenant.mockResolvedValue({});
    tenantConfigService.deleteByTenantId.mockResolvedValue(undefined);
    plantillasService.ensureSeededForTenant.mockResolvedValue(
      PLANTILLAS_SEED.map((s) => ({ claveSeed: s.claveSeed })),
    );
    plantillasService.deleteAllForTenant.mockResolvedValue(undefined);
    usersService.create.mockResolvedValue({
      _id: new Types.ObjectId(),
      email: 'ana@demo.test',
      nombre: 'Ana Admin',
      rol: Roles.ADMIN_TENANT,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: getModelToken(Tenant.name), useValue: TenantModelCtor },
        { provide: TenantConfigService, useValue: tenantConfigService },
        { provide: UsersService, useValue: usersService },
        { provide: PlantillasService, useValue: plantillasService },
      ],
    }).compile();

    service = module.get(TenantsService);
  });

  it('ensureSeeded es idempotente (2 llamadas → mismos 2 tenants)', async () => {
    const first = await service.ensureSeeded();
    const second = await service.ensureSeeded();

    expect(first).toHaveLength(INITIAL_TENANTS.length);
    expect(second).toHaveLength(INITIAL_TENANTS.length);
    expect(store.size).toBe(2);
    expect([...store.keys()].sort()).toEqual(['los-mochis', 'queretaro']);
  });

  it('ensureSeeded no reactiva seed ya suspendido (Story 4.3)', async () => {
    await service.ensureSeeded();
    const qro = store.get('queretaro');
    qro.activo = false;

    const again = await service.ensureSeeded();
    const updated = again.find((t: any) => t.clave === 'queretaro');
    expect(updated?.activo).toBe(false);
    expect(store.get('queretaro').activo).toBe(false);
  });

  describe('setActivo (Story 4.3)', () => {
    it('suspende y reactiva de forma idempotente', async () => {
      const id = new Types.ObjectId();
      store.set('demo', {
        _id: id,
        nombre: 'Demo SA',
        clave: 'demo',
        activo: true,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      });

      const suspended = await service.setActivo(String(id), false);
      expect(suspended.activo).toBe(false);
      expect(store.get('demo').activo).toBe(false);

      const again = await service.setActivo(String(id), false);
      expect(again.activo).toBe(false);

      const reactivated = await service.setActivo(String(id), true);
      expect(reactivated.activo).toBe(true);
      expect(reactivated.nombre).toBe('Demo SA');
      expect(store.get('demo').activo).toBe(true);
    });

    it('404 si el tenant no existe', async () => {
      const missing = new Types.ObjectId().toString();
      await expect(service.setActivo(missing, false)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAllForPlatform (Story 4.2)', () => {
    it('incluye activos e inactivos; cadena find({}) + sort + select', async () => {
      store.set('zeta', {
        _id: new Types.ObjectId(),
        nombre: 'Zeta SA',
        clave: 'zeta',
        activo: true,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      });
      store.set('alfa', {
        _id: new Types.ObjectId(),
        nombre: 'Alfa SA',
        clave: 'alfa',
        activo: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const sortSpy = jest.fn();
      const selectSpy = jest.fn();
      (TenantModelCtor as any).find.mockImplementation(() => {
        // Simula orden Mongo en exec; se aserta sort/select/find({}) abajo.
        const chain: any = {
          sort: (arg: unknown) => {
            sortSpy(arg);
            return chain;
          },
          select: (arg: unknown) => {
            selectSpy(arg);
            return chain;
          },
          lean: () => chain,
          exec: async () =>
            Array.from(store.values()).sort((a, b) =>
              String(a.nombre).localeCompare(String(b.nombre)),
            ),
        };
        return chain;
      });

      const list = await service.findAllForPlatform();
      expect((TenantModelCtor as any).find).toHaveBeenCalledWith({});
      expect(sortSpy).toHaveBeenCalledWith({ nombre: 1 });
      expect(selectSpy).toHaveBeenCalledWith({
        nombre: 1,
        clave: 1,
        activo: 1,
        createdAt: 1,
      });
      expect(list).toHaveLength(2);
      expect(list[0].nombre).toBe('Alfa SA');
      expect(list[0].activo).toBe(false);
      expect(list[0].clave).toBe('alfa');
      expect(list[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(list[1].nombre).toBe('Zeta SA');
      expect(list[1].activo).toBe(true);
    });

    it('omite createdAt inválido sin tumbar el listado', async () => {
      store.set('bad-date', {
        _id: new Types.ObjectId(),
        nombre: 'Bad Date SA',
        clave: 'bad-date',
        activo: true,
        createdAt: 'not-a-date',
      });

      const list = await service.findAllForPlatform();
      expect(list).toHaveLength(1);
      expect(list[0].nombre).toBe('Bad Date SA');
      expect(list[0].createdAt).toBeUndefined();
    });
  });

  describe('onboard (Story 4.1)', () => {
    const dto = {
      tenant: { nombre: 'Demo SA', clave: 'Demo-SA' },
      admin: {
        nombre: 'Ana Admin',
        email: 'ana@demo.test',
        password: 'secreto1',
      },
    };

    it('happy path: tenant + config + seeds + activar + UsersService.create sin actor', async () => {
      const res = await service.onboard(dto as any);

      expect(res.tenant.clave).toBe('demo-sa');
      expect(res.tenant.activo).toBe(true);
      expect(store.get('demo-sa').activo).toBe(true);
      expect(res.admin.email).toBe('ana@demo.test');
      expect(res.admin.rol).toBe(Roles.ADMIN_TENANT);
      expect(res.plantillasSeedCount).toBe(PLANTILLAS_SEED.length);

      expect(tenantConfigService.findOrCreateForTenant).toHaveBeenCalled();
      expect(plantillasService.ensureSeededForTenant).toHaveBeenCalled();
      expect((TenantModelCtor as any).findByIdAndUpdate).toHaveBeenCalled();
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ana@demo.test',
          rol: Roles.ADMIN_TENANT,
          tenantId: expect.any(String),
        }),
      );
      // sin segundo arg actor
      expect(usersService.create.mock.calls[0]).toHaveLength(1);
      expect(plantillasService.deleteAllForTenant).not.toHaveBeenCalled();
      expect(tenantConfigService.deleteByTenantId).not.toHaveBeenCalled();
    });

    it('fallo en seeds → compensación; tenant nunca queda activo listable', async () => {
      plantillasService.ensureSeededForTenant.mockRejectedValue(
        new Error('seed fail'),
      );
      await expect(service.onboard(dto as any)).rejects.toThrow('seed fail');
      expect(usersService.create).not.toHaveBeenCalled();
      expect((TenantModelCtor as any).findByIdAndUpdate).not.toHaveBeenCalled();
      expect(store.size).toBe(0);
    });

    it('clave inválida → 400 sin persistir', async () => {
      await expect(
        service.onboard({
          ...dto,
          tenant: { nombre: 'X', clave: 'Bad Clave!' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(store.size).toBe(0);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('clave duplicada → 409', async () => {
      store.set('demo-sa', {
        _id: new Types.ObjectId(),
        clave: 'demo-sa',
        nombre: 'Existente',
        activo: true,
      });
      await expect(service.onboard(dto as any)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('fallo en UsersService.create → compensación (sin tenant usable)', async () => {
      usersService.create.mockRejectedValue(new ConflictException('email'));
      await expect(service.onboard(dto as any)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(plantillasService.deleteAllForTenant).toHaveBeenCalled();
      expect(tenantConfigService.deleteByTenantId).toHaveBeenCalled();
      expect((TenantModelCtor as any).deleteOne).toHaveBeenCalled();
      expect(store.size).toBe(0);
    });

    it('fallo de hard-delete en compensación → 500 (no traga el orphan)', async () => {
      usersService.create.mockRejectedValue(new ConflictException('email'));
      (TenantModelCtor as any).deleteOne.mockReturnValueOnce({
        exec: async () => {
          throw new Error('mongo down');
        },
      });

      await expect(service.onboard(dto as any)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(store.size).toBe(1);
      expect(store.get('demo-sa')).toBeTruthy();
    });

    it('no invoca CRM/servicios (solo users + plantillas + config)', async () => {
      await service.onboard(dto as any);
      expect(usersService.create).toHaveBeenCalledTimes(1);
      expect(plantillasService.ensureSeededForTenant).toHaveBeenCalledTimes(1);
      expect(tenantConfigService.findOrCreateForTenant).toHaveBeenCalledTimes(
        1,
      );
    });
  });
});
