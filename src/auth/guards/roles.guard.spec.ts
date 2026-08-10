import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Roles } from '../enums/roles.enum';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  const ctx = (user: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('permite acceso si no hay roles requeridos', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(ctx({ rol: Roles.OPERATIVO }))).toBe(true);
  });

  it('permite operativo y admin_sistema cuando ambos están requeridos', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      Roles.OPERATIVO,
      Roles.ADMIN_SISTEMA,
    ]);
    expect(guard.canActivate(ctx({ rol: Roles.OPERATIVO }))).toBe(true);
    expect(guard.canActivate(ctx({ rol: Roles.ADMIN_SISTEMA }))).toBe(true);
  });

  it('permite admin_tenant cuando está en roles requeridos', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      Roles.OPERATIVO,
      Roles.ADMIN_TENANT,
      Roles.ADMIN_SISTEMA,
    ]);
    expect(guard.canActivate(ctx({ rol: Roles.ADMIN_TENANT }))).toBe(true);
  });

  it('deniega admin_tenant si no está en requiredRoles', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      Roles.ADMIN_SISTEMA,
    ]);
    expect(() =>
      guard.canActivate(ctx({ rol: Roles.ADMIN_TENANT })),
    ).toThrow(ForbiddenException);
  });

  it('deniega rol desconocido', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      Roles.ADMIN_SISTEMA,
    ]);
    expect(() => guard.canActivate(ctx({ rol: 'cliente' }))).toThrow(
      ForbiddenException,
    );
  });

  it('deniega sin usuario', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      Roles.OPERATIVO,
    ]);
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});
