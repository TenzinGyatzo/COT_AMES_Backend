import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/enums/roles.enum';
import { TenantsController } from './tenants.controller';

/**
 * Story 4.1 / AD-16 — POST /tenants/onboard solo admin_sistema
 * (metadata class-level del controller real).
 */
describe('tenants onboard RolesGuard + metadata real (Story 4.1)', () => {
  const reflector = new Reflector();
  const rolesGuard = new RolesGuard(reflector);

  const rolesCtx = (user: { rol?: string } | null) =>
    ({
      getHandler: () => TenantsController.prototype.onboard,
      getClass: () => TenantsController,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as any;

  it('admin_sistema → allow', () => {
    expect(
      rolesGuard.canActivate(rolesCtx({ rol: Roles.ADMIN_SISTEMA })),
    ).toBe(true);
  });

  it('admin_tenant → deny', () => {
    expect(() =>
      rolesGuard.canActivate(rolesCtx({ rol: Roles.ADMIN_TENANT })),
    ).toThrow(ForbiddenException);
  });

  it('operativo → deny', () => {
    expect(() =>
      rolesGuard.canActivate(rolesCtx({ rol: Roles.OPERATIVO })),
    ).toThrow(ForbiddenException);
  });

  it('sin user → deny', () => {
    expect(() => rolesGuard.canActivate(rolesCtx(null))).toThrow(
      ForbiddenException,
    );
  });
});

/**
 * Story 4.2 / AD-16 — GET /tenants inventario plataforma solo admin_sistema
 * (misma metadata class-level).
 */
describe('tenants findAll RolesGuard + metadata real (Story 4.2)', () => {
  const reflector = new Reflector();
  const rolesGuard = new RolesGuard(reflector);

  const rolesCtx = (user: { rol?: string } | null) =>
    ({
      getHandler: () => TenantsController.prototype.findAll,
      getClass: () => TenantsController,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as any;

  it('admin_sistema → allow', () => {
    expect(
      rolesGuard.canActivate(rolesCtx({ rol: Roles.ADMIN_SISTEMA })),
    ).toBe(true);
  });

  it('admin_tenant → deny', () => {
    expect(() =>
      rolesGuard.canActivate(rolesCtx({ rol: Roles.ADMIN_TENANT })),
    ).toThrow(ForbiddenException);
  });

  it('operativo → deny', () => {
    expect(() =>
      rolesGuard.canActivate(rolesCtx({ rol: Roles.OPERATIVO })),
    ).toThrow(ForbiddenException);
  });

  it('sin user → deny', () => {
    expect(() => rolesGuard.canActivate(rolesCtx(null))).toThrow(
      ForbiddenException,
    );
  });
});

/**
 * Story 4.3 / AD-16 — PATCH /tenants/:id/activo solo admin_sistema
 */
describe('tenants setActivo RolesGuard + metadata real (Story 4.3)', () => {
  const reflector = new Reflector();
  const rolesGuard = new RolesGuard(reflector);

  const rolesCtx = (user: { rol?: string } | null) =>
    ({
      getHandler: () => TenantsController.prototype.setActivo,
      getClass: () => TenantsController,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as any;

  it('admin_sistema → allow', () => {
    expect(
      rolesGuard.canActivate(rolesCtx({ rol: Roles.ADMIN_SISTEMA })),
    ).toBe(true);
  });

  it('admin_tenant → deny', () => {
    expect(() =>
      rolesGuard.canActivate(rolesCtx({ rol: Roles.ADMIN_TENANT })),
    ).toThrow(ForbiddenException);
  });

  it('operativo → deny', () => {
    expect(() =>
      rolesGuard.canActivate(rolesCtx({ rol: Roles.OPERATIVO })),
    ).toThrow(ForbiddenException);
  });

  it('sin user → deny', () => {
    expect(() => rolesGuard.canActivate(rolesCtx(null))).toThrow(
      ForbiddenException,
    );
  });
});
