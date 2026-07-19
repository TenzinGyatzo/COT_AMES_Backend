import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { Roles } from '../auth/enums/roles.enum';
import { TenantContextGuard } from './tenant-context.guard';

describe('TenantContextGuard', () => {
  const tenantsService = {
    findById: jest.fn(),
  };
  const guard = new TenantContextGuard(tenantsService as any);

  const makeCtx = (req: Record<string, unknown>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('operativo: usa tenantId del JWT e ignora header cliente', async () => {
    const tenantId = new Types.ObjectId();
    const req: any = {
      user: { rol: Roles.OPERATIVO, tenantId: tenantId.toString() },
      headers: { 'x-tenant-id': new Types.ObjectId().toString() },
    };

    await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
    expect(String(req.effectiveTenantId)).toBe(String(tenantId));
    expect(tenantsService.findById).not.toHaveBeenCalled();
  });

  it('operativo sin tenantId: 403', async () => {
    const req: any = {
      user: { rol: Roles.OPERATIVO },
      headers: {},
    };

    await expect(guard.canActivate(makeCtx(req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('admin_sistema sin header: 400', async () => {
    const req: any = {
      user: { rol: Roles.ADMIN_SISTEMA },
      headers: {},
    };

    await expect(guard.canActivate(makeCtx(req))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('admin_sistema con header solo whitespace: 400', async () => {
    const req: any = {
      user: { rol: Roles.ADMIN_SISTEMA },
      headers: { 'x-tenant-id': '   ' },
    };

    await expect(guard.canActivate(makeCtx(req))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('admin_sistema con header multi-valor: 400', async () => {
    const a = new Types.ObjectId().toString();
    const b = new Types.ObjectId().toString();
    const req: any = {
      user: { rol: Roles.ADMIN_SISTEMA },
      headers: { 'x-tenant-id': [a, b] },
    };

    await expect(guard.canActivate(makeCtx(req))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('admin_sistema con ObjectId inválido (12 chars): 403', async () => {
    const req: any = {
      user: { rol: Roles.ADMIN_SISTEMA },
      headers: { 'x-tenant-id': 'abcdefghijkl' },
    };

    await expect(guard.canActivate(makeCtx(req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tenantsService.findById).not.toHaveBeenCalled();
  });

  it('admin_sistema con header válido: setea effectiveTenantId', async () => {
    const tenantId = new Types.ObjectId();
    tenantsService.findById.mockResolvedValue({
      _id: tenantId,
      activo: true,
    });
    const req: any = {
      user: { rol: Roles.ADMIN_SISTEMA },
      headers: { 'x-tenant-id': tenantId.toString() },
    };

    await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
    expect(String(req.effectiveTenantId)).toBe(String(tenantId));
  });

  it('admin_sistema con tenant inexistente: 403', async () => {
    tenantsService.findById.mockResolvedValue(null);
    const req: any = {
      user: { rol: Roles.ADMIN_SISTEMA },
      headers: { 'x-tenant-id': new Types.ObjectId().toString() },
    };

    await expect(guard.canActivate(makeCtx(req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('admin_sistema con tenant inactivo: 403', async () => {
    const tenantId = new Types.ObjectId();
    tenantsService.findById.mockResolvedValue({
      _id: tenantId,
      activo: false,
    });
    const req: any = {
      user: { rol: Roles.ADMIN_SISTEMA },
      headers: { 'x-tenant-id': tenantId.toString() },
    };

    await expect(guard.canActivate(makeCtx(req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
