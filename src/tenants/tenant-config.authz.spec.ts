import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { AMES_ROLES, Roles } from '../auth/enums/roles.enum';
import { TenantConfigController } from './tenant-config.controller';

/**
 * Story 2.4 / FR42 / AD-16:
 * - Writes tenant-config: RolesGuard + @Roles(admin_tenant, admin_sistema)
 * - GET: AMES_ROLES (operativo lee para PDF)
 * - AdminGuard sigue ≡ solo admin_sistema (FR17 multi-tenant servicios)
 */
const WRITE_ROLES = [Roles.ADMIN_TENANT, Roles.ADMIN_SISTEMA];

const WRITE_HANDLERS = [
  'patchBranding',
  'patchEmail',
  'patchVigenciaBancarios',
  'uploadLogo',
  'deleteLogo',
  'uploadBankLogo',
  'deleteBankLogo',
] as const;

describe('tenant-config controller roles metadata (Story 2.4)', () => {
  const reflector = new Reflector();

  it.each(WRITE_HANDLERS)(
    '%s → CONFIG_WRITE_ROLES (override sobre AMES_ROLES de clase)',
    (name) => {
      const handler = TenantConfigController.prototype[name];
      const roles = reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        handler,
        TenantConfigController,
      ]);
      expect(roles).toEqual(WRITE_ROLES);
    },
  );

  it('GET → AMES_ROLES (lectura PDF / núcleo)', () => {
    const roles = reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      TenantConfigController.prototype.get,
      TenantConfigController,
    ]);
    expect(roles).toEqual([...AMES_ROLES]);
  });
});

describe('tenant-config RolesGuard + metadata real (Story 2.4)', () => {
  const reflector = new Reflector();
  const rolesGuard = new RolesGuard(reflector);

  function rolesCtx(
    user: { rol?: string } | null | undefined,
    handler: (...args: unknown[]) => unknown,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => handler,
      getClass: () => TenantConfigController,
    } as unknown as ExecutionContext;
  }

  it('admin_sistema → allow write', () => {
    expect(
      rolesGuard.canActivate(
        rolesCtx(
          { rol: Roles.ADMIN_SISTEMA },
          TenantConfigController.prototype.patchBranding,
        ),
      ),
    ).toBe(true);
  });

  it('admin_tenant → allow write', () => {
    expect(
      rolesGuard.canActivate(
        rolesCtx(
          { rol: Roles.ADMIN_TENANT },
          TenantConfigController.prototype.patchBranding,
        ),
      ),
    ).toBe(true);
  });

  it('operativo → 403 en escritura', () => {
    expect(() =>
      rolesGuard.canActivate(
        rolesCtx(
          { rol: Roles.OPERATIVO },
          TenantConfigController.prototype.patchBranding,
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('sin user → 403 en escritura', () => {
    expect(() =>
      rolesGuard.canActivate(
        rolesCtx(null, TenantConfigController.prototype.patchBranding),
      ),
    ).toThrow(ForbiddenException);
  });

  it('operativo → allow GET (AMES_ROLES)', () => {
    expect(
      rolesGuard.canActivate(
        rolesCtx(
          { rol: Roles.OPERATIVO },
          TenantConfigController.prototype.get,
        ),
      ),
    ).toBe(true);
  });

  it('admin_tenant → allow GET', () => {
    expect(
      rolesGuard.canActivate(
        rolesCtx(
          { rol: Roles.ADMIN_TENANT },
          TenantConfigController.prototype.get,
        ),
      ),
    ).toBe(true);
  });
});

describe('AdminGuard permanece solo admin_sistema (FR17 / Story 2.4)', () => {
  const guard = new AdminGuard();

  function ctx(user: { rol?: string } | null): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as ExecutionContext;
  }

  it('admin_sistema → allow', () => {
    expect(guard.canActivate(ctx({ rol: Roles.ADMIN_SISTEMA }))).toBe(true);
  });

  it('admin_tenant → 403 (no ensanchar AdminGuard)', () => {
    expect(() =>
      guard.canActivate(ctx({ rol: Roles.ADMIN_TENANT })),
    ).toThrow(ForbiddenException);
  });

  it('operativo → 403', () => {
    expect(() => guard.canActivate(ctx({ rol: Roles.OPERATIVO }))).toThrow(
      ForbiddenException,
    );
  });

  it('sin user → 403', () => {
    expect(() => guard.canActivate(ctx(null))).toThrow(ForbiddenException);
  });
});
