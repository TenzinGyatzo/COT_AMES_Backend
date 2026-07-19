import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant, TenantDocument } from './schemas/tenant.schema';

export const INITIAL_TENANTS = [
  { clave: 'queretaro', nombre: 'Querétaro' },
  { clave: 'los-mochis', nombre: 'Los Mochis' },
] as const;

@Injectable()
export class TenantsService implements OnModuleInit {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
  ) {}

  async onModuleInit() {
    await this.ensureSeeded();
  }

  async ensureSeeded(): Promise<Tenant[]> {
    const results: Tenant[] = [];
    for (const t of INITIAL_TENANTS) {
      const doc = await this.tenantModel
        .findOneAndUpdate(
          { clave: t.clave },
          {
            $set: {
              nombre: t.nombre,
              activo: true,
            },
            $setOnInsert: {
              clave: t.clave,
            },
          },
          { upsert: true, new: true },
        )
        .exec();
      results.push(doc);
    }
    this.logger.log(
      `Tenants seed OK: ${results.map((r) => (r as any).clave).join(', ')}`,
    );
    return results;
  }

  async findAllActive(): Promise<Tenant[]> {
    return this.tenantModel.find({ activo: true }).sort({ nombre: 1 }).exec();
  }

  async findByClave(clave: string): Promise<Tenant | null> {
    return this.tenantModel.findOne({ clave, activo: true }).exec();
  }

  async findById(id: string): Promise<TenantDocument | null> {
    return this.tenantModel.findById(id).exec();
  }
}
