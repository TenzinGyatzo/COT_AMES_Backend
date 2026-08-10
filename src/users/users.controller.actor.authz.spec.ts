import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Roles } from '../auth/enums/roles.enum';
import { UsersController } from './users.controller';

describe('UsersController.actorFrom (Story 4.3 / AD-14)', () => {
  const usersService = {} as any;
  const tenantsService = { findById: jest.fn() };
  const controller = new UsersController(usersService, tenantsService as any);
  const actorFrom = (controller as any).actorFrom.bind(controller) as (
    user: { rol?: string; tenantId?: string },
    req: { headers?: Record<string, unknown> },
  ) => Promise<unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('admin_tenant con tenant inactivo: 403', async () => {
    const tid = new Types.ObjectId().toString();
    tenantsService.findById.mockResolvedValue({ _id: tid, activo: false });

    await expect(
      actorFrom({ rol: Roles.ADMIN_TENANT, tenantId: tid }, { headers: {} }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admin_tenant con tenant activo: ok', async () => {
    const tid = new Types.ObjectId().toString();
    tenantsService.findById.mockResolvedValue({ _id: tid, activo: true });

    await expect(
      actorFrom({ rol: Roles.ADMIN_TENANT, tenantId: tid }, { headers: {} }),
    ).resolves.toEqual({
      rol: Roles.ADMIN_TENANT,
      tenantId: tid,
      supportTenantId: null,
    });
  });

  it('admin_sistema con tenant inactivo: allow supportTenantId', async () => {
    const tid = new Types.ObjectId().toString();
    tenantsService.findById.mockResolvedValue({ _id: tid, activo: false });

    await expect(
      actorFrom(
        { rol: Roles.ADMIN_SISTEMA },
        { headers: { 'x-tenant-id': tid } },
      ),
    ).resolves.toEqual({
      rol: Roles.ADMIN_SISTEMA,
      tenantId: null,
      supportTenantId: tid,
    });
  });

  it('admin_sistema con tenant inexistente: 403', async () => {
    const tid = new Types.ObjectId().toString();
    tenantsService.findById.mockResolvedValue(null);

    await expect(
      actorFrom(
        { rol: Roles.ADMIN_SISTEMA },
        { headers: { 'x-tenant-id': tid } },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
