import { ForbiddenException, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { tenantAls } from './tenant-als';

/**
 * Contexto de tenant efectivo del request (AD-2).
 * Usa AsyncLocalStorage (no REQUEST-scope) para no romper Cron de cotizaciones.
 */
@Injectable()
export class TenantContextService {
  /** Establece el tenant para el resto del request (lo llama el interceptor). */
  runWithTenant<T>(tenantId: Types.ObjectId, fn: () => T): T {
    return tenantAls.run(tenantId, fn);
  }

  getTenantId(): Types.ObjectId {
    const tenantId = tenantAls.getStore();
    if (!tenantId) {
      throw new ForbiddenException('Contexto de tenant no resuelto');
    }
    return tenantId;
  }
}
