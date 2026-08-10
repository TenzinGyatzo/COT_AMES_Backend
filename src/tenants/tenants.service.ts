import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tenant, TenantDocument } from './schemas/tenant.schema';
import { TenantConfigService } from './tenant-config.service';
import { UsersService } from '../users/users.service';
import { PlantillasService } from '../plantillas/plantillas.service';
import { Roles } from '../auth/enums/roles.enum';
import { OnboardTenantDto } from './dto/onboard-tenant.dto';
import { assertStrictObjectIdOrNotFound } from '../common/strict-object-id';

export const INITIAL_TENANTS = [
  { clave: 'queretaro', nombre: 'Querétaro' },
  { clave: 'los-mochis', nombre: 'Los Mochis' },
] as const;

export type OnboardTenantResult = {
  tenant: {
    _id: string;
    nombre: string;
    clave: string;
    activo: boolean;
  };
  admin: {
    _id: string;
    email: string;
    nombre: string;
    rol: string;
  };
  plantillasSeedCount: number;
};

/** Inventario plataforma (Story 4.2 / FR44) — activos e inactivos. */
export type TenantListItem = {
  _id: string;
  nombre: string;
  clave: string;
  activo: boolean;
  createdAt?: string;
};

@Injectable()
export class TenantsService implements OnModuleInit {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    private readonly tenantConfigService: TenantConfigService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => PlantillasService))
    private readonly plantillasService: PlantillasService,
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
            // Story 4.3 / AD-14: no forzar activo en updates (suspend debe persistir).
            $set: {
              nombre: t.nombre,
            },
            $setOnInsert: {
              clave: t.clave,
              activo: true,
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

  /**
   * Story 4.2 / AD-14 / AD-16 — inventario completo para admin_sistema.
   * Incluye `activo: false` (selector FE sigue filtrando activos).
   */
  async findAllForPlatform(): Promise<TenantListItem[]> {
    const docs = await this.tenantModel
      .find({})
      .sort({ nombre: 1 })
      .select({ nombre: 1, clave: 1, activo: 1, createdAt: 1 })
      .lean()
      .exec();

    return docs.map((d) => {
      const row: TenantListItem = {
        _id: String(d._id),
        nombre: d.nombre,
        clave: d.clave,
        activo: d.activo !== false,
      };
      const createdAt = (d as { createdAt?: Date | string }).createdAt;
      if (createdAt) {
        const dt = new Date(createdAt);
        if (!Number.isNaN(dt.getTime())) {
          row.createdAt = dt.toISOString();
        }
      }
      return row;
    });
  }

  async findByClave(clave: string): Promise<Tenant | null> {
    return this.tenantModel.findOne({ clave, activo: true }).exec();
  }

  async findById(id: string): Promise<TenantDocument | null> {
    return this.tenantModel.findById(id).exec();
  }

  /**
   * Story 4.3 / AD-14 / AD-16 — suspender o reactivar (idempotente).
   * No borra datos ni mutea User.activo.
   */
  async setActivo(id: string, activo: boolean): Promise<TenantListItem> {
    assertStrictObjectIdOrNotFound(id, 'Tenant');
    const updated = await this.tenantModel
      .findByIdAndUpdate(id, { $set: { activo } }, { new: true })
      .select({ nombre: 1, clave: 1, activo: 1, createdAt: 1 })
      .lean()
      .exec();
    if (!updated) {
      throw new NotFoundException(`Tenant con ID ${id} no encontrado`);
    }
    const row: TenantListItem = {
      _id: String(updated._id),
      nombre: updated.nombre,
      clave: updated.clave,
      activo: updated.activo !== false,
    };
    const createdAt = (updated as { createdAt?: Date | string }).createdAt;
    if (createdAt) {
      const dt = new Date(createdAt);
      if (!Number.isNaN(dt.getTime())) {
        row.createdAt = dt.toISOString();
      }
    }
    return row;
  }

  /**
   * Story 4.1 / AD-13 — onboard atómico:
   * Tenant (activo:false) → config → seeds → activar → primer admin_tenant.
   * Fallo parcial → compensación hard-delete (falla ruidosa si queda huérfano).
   */
  async onboard(dto: OnboardTenantDto): Promise<OnboardTenantResult> {
    const nombre = dto.tenant.nombre.trim();
    if (!nombre) {
      throw new BadRequestException('El nombre del tenant es obligatorio');
    }
    const clave = this.normalizeClave(dto.tenant.clave);

    let tenantId: Types.ObjectId | null = null;
    try {
      const tenant = await this.createTenantDoc(nombre, clave);
      tenantId = tenant._id as Types.ObjectId;

      await this.tenantConfigService.findOrCreateForTenant(tenantId);

      const seeds = await this.plantillasService.ensureSeededForTenant(tenantId);

      // Listable solo tras seeds; UsersService exige tenant activo (AD-11).
      const activated = await this.activateTenant(tenantId);

      const admin = await this.usersService.create({
        email: dto.admin.email,
        password: dto.admin.password,
        nombre: dto.admin.nombre,
        rol: Roles.ADMIN_TENANT,
        tenantId: String(tenantId),
      });

      return {
        tenant: {
          _id: String(tenantId),
          nombre: activated.nombre,
          clave: activated.clave,
          activo: true,
        },
        admin: {
          _id: String((admin as any)._id),
          email: admin.email,
          nombre: admin.nombre,
          rol: admin.rol,
        },
        plantillasSeedCount: seeds.length,
      };
    } catch (err) {
      if (tenantId) {
        await this.compensatePartialOnboard(tenantId);
      }
      throw err;
    }
  }

  private normalizeClave(raw: string): string {
    const clave = String(raw || '')
      .trim()
      .toLowerCase();
    if (!clave) {
      throw new BadRequestException('La clave del tenant es obligatoria');
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clave)) {
      throw new BadRequestException(
        'La clave del tenant debe ser un slug lowercase (letras, números y guiones)',
      );
    }
    return clave;
  }

  /** Provisioning: crea tenant `activo: false` (visible en inventario 4.2 como inactivo hasta activateTenant). */
  private async createTenantDoc(
    nombre: string,
    clave: string,
  ): Promise<TenantDocument> {
    try {
      const doc = new this.tenantModel({ nombre, clave, activo: false });
      return await doc.save();
    } catch (err) {
      if (this.isDuplicateKeyError(err)) {
        throw new ConflictException('La clave de tenant ya existe');
      }
      throw err;
    }
  }

  /** Onboard: activa tras seeds vía setActivo (mismo $set / proyección). */
  private async activateTenant(
    tenantId: Types.ObjectId,
  ): Promise<TenantDocument> {
    await this.setActivo(String(tenantId), true);
    const updated = await this.tenantModel.findById(tenantId).exec();
    if (!updated) {
      throw new InternalServerErrorException(
        'No se pudo activar el tenant tras el provisionamiento',
      );
    }
    return updated;
  }

  /**
   * Hard-delete parcial. Si no puede eliminar el tenant, lanza 500
   * (AC#2: no reportar éxito limpio dejando huérfano usable).
   */
  private async compensatePartialOnboard(
    tenantId: Types.ObjectId,
  ): Promise<void> {
    const errors: string[] = [];

    try {
      await this.plantillasService.deleteAllForTenant(tenantId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`plantillas: ${msg}`);
      this.logger.error(
        `Compensación plantillas falló tenant ${tenantId}: ${msg}`,
      );
    }

    try {
      await this.tenantConfigService.deleteByTenantId(tenantId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`config: ${msg}`);
      this.logger.error(
        `Compensación config falló tenant ${tenantId}: ${msg}`,
      );
    }

    try {
      const res = await this.tenantModel.deleteOne({ _id: tenantId }).exec();
      if ((res.deletedCount ?? 0) === 0) {
        const still = await this.tenantModel.findById(tenantId).exec();
        if (still) {
          errors.push('tenant: deleteOne no eliminó el documento');
          this.logger.error(
            `Compensación tenant no eliminó documento ${tenantId}`,
          );
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`tenant: ${msg}`);
      this.logger.error(`Compensación tenant falló ${tenantId}: ${msg}`);
    }

    if (errors.length > 0) {
      throw new InternalServerErrorException(
        `Compensación de onboard incompleta (${String(tenantId)}): ${errors.join('; ')}`,
      );
    }
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      ((err as { code?: number | string }).code === 11000 ||
        (err as { code?: number | string }).code === 'E11000')
    );
  }
}
