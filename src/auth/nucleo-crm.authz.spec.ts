import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { AdminGuard } from './guards/admin.guard';
import { RolesGuard } from './guards/roles.guard';
import { ROLES_KEY } from './decorators/roles.decorator';
import { AMES_ROLES, Roles } from './enums/roles.enum';
import { ClientesController } from '../clientes/clientes.controller';
import { ContactosController } from '../clientes/contactos.controller';
import { CotizacionesController } from '../cotizaciones/cotizaciones.controller';
import { ServiciosController } from '../servicios/servicios.controller';
import { PlantillasController } from '../plantillas/plantillas.controller';
import { MetricsController } from '../metrics/metrics.controller';
import { DashboardController } from '../dashboard/dashboard.controller';
import { TenantsController } from '../tenants/tenants.controller';

/**
 * Story 2.5 / AD-11:
 * Núcleo CRM ya decorado con AMES_ROLES (2.1). Esta suite fija inclusión
 * admin_tenant ⊃ operativo, FR17 AdminGuard, y plataforma solo admin_sistema.
 */

type HandlerSample = {
  label: string;
  handler: (...args: never[]) => unknown;
  cls: abstract new (...args: never[]) => unknown;
};

const NUCLEO_SAMPLES: HandlerSample[] = [
  {
    label: 'clientes.create',
    handler: ClientesController.prototype.create,
    cls: ClientesController,
  },
  {
    label: 'clientes.findAll',
    handler: ClientesController.prototype.findAll,
    cls: ClientesController,
  },
  {
    label: 'contactos.create',
    handler: ContactosController.prototype.create,
    cls: ContactosController,
  },
  {
    label: 'cotizaciones.create',
    handler: CotizacionesController.prototype.create,
    cls: CotizacionesController,
  },
  {
    label: 'cotizaciones.findAll',
    handler: CotizacionesController.prototype.findAll,
    cls: CotizacionesController,
  },
  {
    label: 'servicios.create',
    handler: ServiciosController.prototype.create,
    cls: ServiciosController,
  },
  {
    label: 'plantillas.create',
    handler: PlantillasController.prototype.create,
    cls: PlantillasController,
  },
  {
    label: 'metrics.getClientsMetrics',
    handler: MetricsController.prototype.getClientsMetrics,
    cls: MetricsController,
  },
  {
    label: 'dashboard.getEntityTotals',
    handler: DashboardController.prototype.getEntityTotals,
    cls: DashboardController,
  },
];

describe('núcleo CRM roles metadata (Story 2.5)', () => {
  const reflector = new Reflector();

  it('AMES_ROLES incluye los tres roles', () => {
    expect(AMES_ROLES).toEqual([
      Roles.OPERATIVO,
      Roles.ADMIN_TENANT,
      Roles.ADMIN_SISTEMA,
    ]);
  });

  it.each(NUCLEO_SAMPLES.map((s) => [s.label, s] as const))(
    '%s → AMES_ROLES',
    (_label, { handler, cls }) => {
      const roles = reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        handler,
        cls,
      ]);
      expect(roles).toEqual([...AMES_ROLES]);
    },
  );
});

describe('núcleo CRM RolesGuard + metadata real (Story 2.5)', () => {
  const reflector = new Reflector();
  const rolesGuard = new RolesGuard(reflector);

  function rolesCtx(
    user: { rol?: string } | null | undefined,
    sample: HandlerSample,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => sample.handler,
      getClass: () => sample.cls,
    } as unknown as ExecutionContext;
  }

  const sample = NUCLEO_SAMPLES[0];

  it('operativo → allow núcleo', () => {
    expect(
      rolesGuard.canActivate(rolesCtx({ rol: Roles.OPERATIVO }, sample)),
    ).toBe(true);
  });

  it('admin_tenant → allow núcleo (⊃ operativo)', () => {
    expect(
      rolesGuard.canActivate(rolesCtx({ rol: Roles.ADMIN_TENANT }, sample)),
    ).toBe(true);
  });

  it('admin_sistema → allow núcleo', () => {
    expect(
      rolesGuard.canActivate(rolesCtx({ rol: Roles.ADMIN_SISTEMA }, sample)),
    ).toBe(true);
  });

  it('sin user → 403', () => {
    expect(() => rolesGuard.canActivate(rolesCtx(null, sample))).toThrow(
      ForbiddenException,
    );
  });

  it('rol desconocido → 403', () => {
    expect(() =>
      rolesGuard.canActivate(rolesCtx({ rol: 'cliente' }, sample)),
    ).toThrow(ForbiddenException);
  });
});

describe('FR17 POST /servicios/multi-tenant AdminGuard (Story 2.5)', () => {
  const guard = new AdminGuard();

  function ctx(user: { rol?: string } | null): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('createMulti declara @UseGuards(AdminGuard)', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      ServiciosController.prototype.createMulti,
    ) as unknown[] | undefined;
    expect(Array.isArray(guards)).toBe(true);
    expect(guards).toContain(AdminGuard);
  });

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
});

describe('plataforma GET /tenants solo admin_sistema (Story 2.5 / AD-16)', () => {
  const reflector = new Reflector();
  const rolesGuard = new RolesGuard(reflector);

  function rolesCtx(
    user: { rol?: string } | null | undefined,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => TenantsController.prototype.findAll,
      getClass: () => TenantsController,
    } as unknown as ExecutionContext;
  }

  it('metadata → solo admin_sistema', () => {
    const roles = reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      TenantsController.prototype.findAll,
      TenantsController,
    ]);
    expect(roles).toEqual([Roles.ADMIN_SISTEMA]);
  });

  it('admin_sistema → allow', () => {
    expect(
      rolesGuard.canActivate(rolesCtx({ rol: Roles.ADMIN_SISTEMA })),
    ).toBe(true);
  });

  it('admin_tenant → 403', () => {
    expect(() =>
      rolesGuard.canActivate(rolesCtx({ rol: Roles.ADMIN_TENANT })),
    ).toThrow(ForbiddenException);
  });

  it('operativo → 403', () => {
    expect(() =>
      rolesGuard.canActivate(rolesCtx({ rol: Roles.OPERATIVO })),
    ).toThrow(ForbiddenException);
  });
});
