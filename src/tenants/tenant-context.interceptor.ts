import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Types } from 'mongoose';
import { TenantContextService } from './tenant-context.service';

/**
 * Propaga `req.effectiveTenantId` (resuelto por TenantContextGuard) al ALS
 * para que los services lean el tenant vía TenantContextService.getTenantId().
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const tenantId = req.effectiveTenantId as Types.ObjectId | undefined;
    if (!tenantId) {
      throw new ForbiddenException('Contexto de tenant no resuelto');
    }

    return new Observable((subscriber) => {
      const subscription = this.tenantContext.runWithTenant(tenantId, () =>
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        }),
      );
      return () => subscription.unsubscribe();
    });
  }
}
