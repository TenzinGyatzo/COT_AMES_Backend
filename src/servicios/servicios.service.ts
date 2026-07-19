import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Servicio, ServicioDocument } from './schemas/servicio.schema';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { CreateServicioMultiDto } from './dto/create-servicio-multi.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';
import { FilterServicioDto } from './dto/filter-servicio.dto';
import { PaginatedServiciosResponseDto } from './dto/paginated-servicios-response.dto';
import { TenantContextService } from '../tenants/tenant-context.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  assertStrictObjectIdOrNotFound,
  isStrictObjectId,
} from '../common/strict-object-id';
import { CategoriaServicio } from './enums/categoria-servicio.enum';

@Injectable()
export class ServiciosService implements OnModuleInit {
  private readonly logger = new Logger(ServiciosService.name);

  constructor(
    @InjectModel(Servicio.name) private servicioModel: Model<ServicioDocument>,
    private tenantContext: TenantContextService,
    private tenantsService: TenantsService,
  ) {}

  private escapeRegex(term: string): string {
    return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private buildDocPayload(
    dto: CreateServicioDto,
    tenantId: Types.ObjectId,
  ): Record<string, unknown> {
    const descripcion = dto.descripcion?.trim();
    return {
      nombre: dto.nombre.trim(),
      ...(descripcion ? { descripcion } : {}),
      precioUnitario: dto.precioUnitario,
      categoria: dto.categoria,
      tenantId,
      moneda: 'MXN',
      activo: dto.activo !== undefined ? dto.activo : true,
    };
  }

  /** Backfill one-shot: docs legacy sin categoria → OTR. */
  async onModuleInit() {
    try {
      const result = await this.servicioModel.updateMany(
        {
          $or: [
            { categoria: { $exists: false } },
            { categoria: null },
            { categoria: '' },
          ],
        },
        { $set: { categoria: CategoriaServicio.OTR } },
      );
      if (result.modifiedCount > 0) {
        this.logger.log(
          `Backfill categoria=OTR en ${result.modifiedCount} servicio(s) legacy`,
        );
      }
    } catch (err) {
      this.logger.warn(`Backfill categoria omitido: ${String(err)}`);
    }
  }

  async create(createServicioDto: CreateServicioDto): Promise<Servicio> {
    try {
      const tenantId = this.tenantContext.getTenantId();
      const servicio = new this.servicioModel(
        this.buildDocPayload(createServicioDto, tenantId),
      );
      return await servicio.save();
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      throw new BadRequestException('Error al crear el servicio');
    }
  }

  /**
   * Story 4.4 — create-only multi-tenant (admin).
   * Destinos = dto.tenantIds (tenants activos); no usa getTenantId() como destino.
   */
  async createForTenants(
    dto: CreateServicioMultiDto,
  ): Promise<{ created: Servicio[] }> {
    const uniqueIds = [...new Set(dto.tenantIds.map((id) => String(id)))];
    if (uniqueIds.length < 1 || uniqueIds.length > 2) {
      throw new BadRequestException(
        'Debe indicar entre 1 y 2 tenants destino',
      );
    }

    const resolved: Types.ObjectId[] = [];
    for (const id of uniqueIds) {
      // Destinos de create multi → 400 (no 404 de recurso), alineado a Swagger
      if (!isStrictObjectId(id)) {
        throw new BadRequestException(
          `Tenant destino inválido o inactivo: ${id}`,
        );
      }
      const tenant = await this.tenantsService.findById(id);
      if (!tenant || (tenant as any).activo === false) {
        throw new BadRequestException(
          `Tenant destino inválido o inactivo: ${id}`,
        );
      }
      resolved.push(tenant._id as Types.ObjectId);
    }

    const created: Servicio[] = [];
    try {
      for (const tenantId of resolved) {
        const servicio = new this.servicioModel(
          this.buildDocPayload(dto, tenantId),
        );
        created.push(await servicio.save());
      }
      return { created };
    } catch (err) {
      // Best-effort compensar inserts de este request
      for (const doc of created) {
        try {
          const id = (doc as any)._id;
          if (id) await this.servicioModel.deleteOne({ _id: id }).exec();
        } catch {
          /* ignore */
        }
      }
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      throw new BadRequestException(
        'Error al crear el servicio en los tenants indicados',
      );
    }
  }

  async findAll(
    filters?: FilterServicioDto,
  ): Promise<PaginatedServiciosResponseDto> {
    const tenantId = this.tenantContext.getTenantId();
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters?.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;

    const matchConditions: Record<string, unknown> = { tenantId };

    // Omitido / true → activos (incl. legacy sin campo). false → solo inactivos.
    if (filters?.activo === undefined || filters.activo === true) {
      matchConditions.activo = { $ne: false };
    } else {
      matchConditions.activo = false;
    }

    if (filters?.nombre?.trim()) {
      matchConditions.nombre = {
        $regex: this.escapeRegex(filters.nombre.trim()),
        $options: 'i',
      };
    }

    if (filters?.categoria) {
      matchConditions.categoria = filters.categoria;
    }

    const [data, total] = await Promise.all([
      this.servicioModel
        .find(matchConditions)
        .sort({ nombre: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.servicioModel.countDocuments(matchConditions).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit) || 1),
    };
  }

  /** Story 7.3 — dashboard Totales.servicios */
  async countActive(): Promise<number> {
    const tenantId = this.tenantContext.getTenantId();
    return this.servicioModel
      .countDocuments({ tenantId, activo: { $ne: false } })
      .exec();
  }

  async findOne(id: string): Promise<Servicio> {
    assertStrictObjectIdOrNotFound(id, 'Servicio');
    const tenantId = this.tenantContext.getTenantId();
    const servicio = await this.servicioModel
      .findOne({ _id: id, tenantId })
      .exec();
    if (!servicio) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }
    return servicio;
  }

  async update(
    id: string,
    updateServicioDto: UpdateServicioDto,
  ): Promise<Servicio> {
    assertStrictObjectIdOrNotFound(id, 'Servicio');
    const tenantId = this.tenantContext.getTenantId();

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};

    if (updateServicioDto.nombre !== undefined) {
      $set.nombre = updateServicioDto.nombre.trim();
    }
    if (updateServicioDto.descripcion !== undefined) {
      const d = updateServicioDto.descripcion.trim();
      if (d) $set.descripcion = d;
      else $unset.descripcion = 1;
    }
    if (updateServicioDto.precioUnitario !== undefined) {
      $set.precioUnitario = updateServicioDto.precioUnitario;
    }
    if (updateServicioDto.categoria !== undefined) {
      $set.categoria = updateServicioDto.categoria;
    }
    if (updateServicioDto.activo !== undefined) {
      $set.activo = updateServicioDto.activo;
    }
    // NFR-4: moneda siempre MXN
    $set.moneda = 'MXN';

    const update: Record<string, unknown> = { $set };
    if (Object.keys($unset).length) update.$unset = $unset;

    const servicio = await this.servicioModel
      .findOneAndUpdate({ _id: id, tenantId }, update, { new: true })
      .exec();
    if (!servicio) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }
    return servicio;
  }

  async toggleActivo(id: string): Promise<Servicio> {
    const servicio = await this.findOne(id);
    const doc = servicio as ServicioDocument;
    // Ausente/legacy = activo (mismo criterio que findAll $ne: false / contactos)
    const currentlyActive = doc.activo !== false;
    doc.activo = !currentlyActive;
    return await doc.save();
  }

  async remove(id: string): Promise<Servicio> {
    assertStrictObjectIdOrNotFound(id, 'Servicio');
    const tenantId = this.tenantContext.getTenantId();
    const servicio = await this.servicioModel
      .findOneAndUpdate(
        { _id: id, tenantId },
        { $set: { activo: false } },
        { new: true },
      )
      .exec();
    if (!servicio) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }
    return servicio;
  }
}
