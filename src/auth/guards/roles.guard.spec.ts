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
