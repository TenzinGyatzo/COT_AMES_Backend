import {
  ForbiddenException,
  ExecutionContext,
} from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Roles } from '../auth/enums/roles.enum';

/**
 * Escritura de tenant-config sigue AdminGuard.
 * GET es Roles AMES + TenantContext (operativo puede leer para PDF FE).
 */
describe('AdminGuard vs tenant-config writes (Story 2.1 / 2.4)', () => {
  const guard = new AdminGuard();

  function ctx(user: { rol?: string } | null): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as ExecutionContext;
  }

  it('admin_sistema → allow (PATCH/POST/DELETE)', () => {
    expect(guard.canActivate(ctx({ rol: Roles.ADMIN_SISTEMA }))).toBe(true);
  });

  it('operativo → 403 en escritura', () => {
    expect(() => guard.canActivate(ctx({ rol: Roles.OPERATIVO }))).toThrow(
      ForbiddenException,
    );
  });

  it('sin user → 403', () => {
    expect(() => guard.canActivate(ctx(null))).toThrow(ForbiddenException);
  });
});
