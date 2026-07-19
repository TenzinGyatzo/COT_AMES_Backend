import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { Roles } from '../auth/enums/roles.enum';
import { isStrictObjectId } from '../common/strict-object-id';
import { TenantsService } from './tenants.service';

export const X_TENANT_ID_HEADER = 'x-tenant-id';

/** Swagger: operativo no envía; admin_sistema sí (400 si falta). */
export const X_TENANT_ID_API_HEADER = {
  name: 'X-Tenant-Id',
  required: false,
  description:
    'Obligatorio para admin_sistema (400 si ausente; 403 si inválido/inactivo). Operativo: no enviar — se ignora; tenant del JWT.',
} as const;

/**
 * Resuelve tenant efectivo (AD-2) y lo deja en `req.effectiveTenantId`.
 * - operativo: JWT/DB `user.tenantId` (ignora header del cliente)
 * - admin_sistema: `X-Tenant-Id` obligatorio y validado
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly tenantsService: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.rol) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    if (user.rol === Roles.OPERATIVO) {
      if (!user.tenantId) {
        throw new ForbiddenException(
          'Usuario operativo sin tenant asignado',
        );
      }
      req.effectiveTenantId = this.toObjectId(user.tenantId);
      return true;
    }

    if (user.rol === Roles.ADMIN_SISTEMA) {
      const header = this.readSingleTenantHeader(
        req.headers?.[X_TENANT_ID_HEADER],
      );
      if (!header) {
        throw new BadRequestException(
          'Header X-Tenant-Id es obligatorio para administrador de sistema',
        );
      }
      if (!isStrictObjectId(header)) {
        throw new ForbiddenException('X-Tenant-Id inválido');
      }
      const tenant = await this.tenantsService.findById(header);
      if (!tenant || !tenant.activo) {
        throw new ForbiddenException('Tenant no encontrado o inactivo');
      }
      req.effectiveTenantId = tenant._id as Types.ObjectId;
      return true;
    }

    throw new ForbiddenException('Rol no autorizado para contexto de tenant');
  }

  private readSingleTenantHeader(raw: unknown): string {
    if (Array.isArray(raw)) {
      if (raw.length !== 1) {
        throw new BadRequestException(
          'Header X-Tenant-Id ambiguo: se esperaba un único valor',
        );
      }
      return typeof raw[0] === 'string' ? raw[0].trim() : '';
    }
    if (typeof raw === 'string') {
      return raw.trim();
    }
    return '';
  }

  private toObjectId(value: string | Types.ObjectId): Types.ObjectId {
    if (value instanceof Types.ObjectId) {
      return value;
    }
    if (!isStrictObjectId(value)) {
      throw new ForbiddenException('tenantId de usuario inválido');
    }
    return new Types.ObjectId(value);
  }
}
