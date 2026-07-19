import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import {
  TenantConfig,
  TenantConfigSchema,
} from './schemas/tenant-config.schema';
import { TenantsService } from './tenants.service';
import { TenantContextService } from './tenant-context.service';
import { TenantContextGuard } from './tenant-context.guard';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantsController } from './tenants.controller';
import { TenantConfigService } from './tenant-config.service';
import { TenantConfigController } from './tenant-config.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: TenantConfig.name, schema: TenantConfigSchema },
    ]),
  ],
  controllers: [TenantsController, TenantConfigController],
  providers: [
    TenantsService,
    TenantContextService,
    TenantContextGuard,
    TenantContextInterceptor,
    TenantConfigService,
  ],
  exports: [
    TenantsService,
    TenantContextService,
    TenantContextGuard,
    TenantContextInterceptor,
    TenantConfigService,
  ],
})
export class TenantsModule {}
