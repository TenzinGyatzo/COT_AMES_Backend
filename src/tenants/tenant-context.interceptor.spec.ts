import { ForbiddenException } from '@nestjs/common';
import { defer, firstValueFrom, from } from 'rxjs';
import { Types } from 'mongoose';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantContextService } from './tenant-context.service';

describe('TenantContextInterceptor', () => {
  const tenantContext = new TenantContextService();
  const interceptor = new TenantContextInterceptor(tenantContext);

  const makeCtx = (req: Record<string, unknown>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as any;

  it('sin effectiveTenantId: ForbiddenException', () => {
    const next = { handle: () => from([null]) };
    expect(() =>
      interceptor.intercept(makeCtx({}), next as any),
    ).toThrow(ForbiddenException);
  });

  it('propaga ALS a handler async (getTenantId disponible)', async () => {
    const tenantId = new Types.ObjectId();
    const next = {
      handle: () =>
        defer(() =>
          from(
            (async () => {
              await Promise.resolve();
              return String(tenantContext.getTenantId());
            })(),
          ),
        ),
    };

    const result = await firstValueFrom(
      interceptor.intercept(
        makeCtx({ effectiveTenantId: tenantId }),
        next as any,
      ),
    );

    expect(result).toBe(String(tenantId));
  });
});
