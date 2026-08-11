import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CategoriaServicioEntity,
  CategoriaServicioDocument,
} from './schemas/categoria-servicio.schema';
import { Servicio, ServicioDocument } from './schemas/servicio.schema';
import { CreateCategoriaServicioDto } from './dto/create-categoria-servicio.dto';
import { UpdateCategoriaServicioDto } from './dto/update-categoria-servicio.dto';
import { FilterCategoriaServicioDto } from './dto/filter-categoria-servicio.dto';
import { PaginatedCategoriasServicioResponseDto } from './dto/paginated-categorias-servicio-response.dto';
import { TenantContextService } from '../tenants/tenant-context.service';
import { assertStrictObjectIdOrNotFound } from '../common/strict-object-id';

@Injectable()
export class CategoriasServicioService {
  constructor(
    @InjectModel(CategoriaServicioEntity.name)
    private categoriaModel: Model<CategoriaServicioDocument>,
    @InjectModel(Servicio.name)
    private servicioModel: Model<ServicioDocument>,
    private tenantContext: TenantContextService,
  ) {}

  private isDuplicateKeyError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      ((err as { code?: number | string }).code === 11000 ||
        (err as { code?: number | string }).code === 'E11000')
    );
  }

  private normalizeCodigo(codigo: string): string {
    return codigo.trim().toUpperCase();
  }

  private rethrowCreateError(err: unknown): never {
    if (
      err instanceof BadRequestException ||
      err instanceof NotFoundException ||
      err instanceof ForbiddenException ||
      err instanceof ConflictException
    ) {
      throw err;
    }
    if (this.isDuplicateKeyError(err)) {
      throw new ConflictException(
        'Ya existe una categoría con ese código en este tenant',
      );
    }
    throw new BadRequestException('Error al crear la categoría');
  }

  private async reactivateExisting(
    existing: CategoriaServicioDocument,
    nombre: string,
  ): Promise<CategoriaServicioEntity> {
    existing.nombre = nombre;
    existing.activo = true;
    try {
      return await existing.save();
    } catch (err) {
      this.rethrowCreateError(err);
    }
  }

  /**
   * Crea categoría o reactiva una inactiva con el mismo código (unique absoluto AD-20).
   * Sin seed / onModuleInit (AD-13).
   */
  async create(
    dto: CreateCategoriaServicioDto,
  ): Promise<CategoriaServicioEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const nombre = dto.nombre.trim();
    const codigo = this.normalizeCodigo(dto.codigo);

    const existing = await this.categoriaModel
      .findOne({ tenantId, codigo })
      .exec();

    if (existing) {
      if (existing.activo !== false) {
        throw new ConflictException(
          'Ya existe una categoría con ese código en este tenant',
        );
      }
      return this.reactivateExisting(existing, nombre);
    }

    try {
      const categoria = new this.categoriaModel({
        tenantId,
        nombre,
        codigo,
        activo: true,
      });
      return await categoria.save();
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException ||
        err instanceof ForbiddenException ||
        err instanceof ConflictException
      ) {
        throw err;
      }
      if (this.isDuplicateKeyError(err)) {
        // Carrera: otro request insertó/reactivó entre findOne y save.
        const raced = await this.categoriaModel
          .findOne({ tenantId, codigo })
          .exec();
        if (raced && raced.activo === false) {
          return this.reactivateExisting(raced, nombre);
        }
        throw new ConflictException(
          'Ya existe una categoría con ese código en este tenant',
        );
      }
      throw new BadRequestException('Error al crear la categoría');
    }
  }

  async findAll(
    filters?: FilterCategoriaServicioDto,
  ): Promise<PaginatedCategoriasServicioResponseDto> {
    const tenantId = this.tenantContext.getTenantId();
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters?.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;

    const matchConditions: Record<string, unknown> = { tenantId };

    // Omitido / true → activas (incl. legacy sin campo). false → solo inactivas.
    if (filters?.activo === undefined || filters.activo === true) {
      matchConditions.activo = { $ne: false };
    } else {
      matchConditions.activo = false;
    }

    const [data, total] = await Promise.all([
      this.categoriaModel
        .find(matchConditions)
        .sort({ createdAt: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.categoriaModel.countDocuments(matchConditions).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit) || 1),
    };
  }

  async findOne(id: string): Promise<CategoriaServicioEntity> {
    assertStrictObjectIdOrNotFound(id, 'Categoría');
    const tenantId = this.tenantContext.getTenantId();
    const categoria = await this.categoriaModel
      .findOne({ _id: id, tenantId })
      .exec();
    if (!categoria) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }
    return categoria;
  }

  async update(
    id: string,
    dto: UpdateCategoriaServicioDto,
  ): Promise<CategoriaServicioEntity> {
    assertStrictObjectIdOrNotFound(id, 'Categoría');
    const tenantId = this.tenantContext.getTenantId();

    const $set: Record<string, unknown> = {};
    // != null: IsOptional salta validators cuando llega null → evita .trim() 500
    if (dto.nombre != null) {
      $set.nombre = String(dto.nombre).trim();
    }
    if (dto.codigo != null) {
      $set.codigo = this.normalizeCodigo(String(dto.codigo));
    }

    if (Object.keys($set).length === 0) {
      return this.findOne(id);
    }

    try {
      const categoria = await this.categoriaModel
        .findOneAndUpdate({ _id: id, tenantId }, { $set }, { new: true })
        .exec();
      if (!categoria) {
        throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
      }
      return categoria;
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException ||
        err instanceof ForbiddenException ||
        err instanceof ConflictException
      ) {
        throw err;
      }
      if (this.isDuplicateKeyError(err)) {
        throw new ConflictException(
          'Ya existe una categoría con ese código en este tenant',
        );
      }
      throw new BadRequestException('Error al actualizar la categoría');
    }
  }

  /**
   * Soft-delete. Bloquea si hay ítems activos con ese categoriaId (FR57 / Story 5.3).
   */
  async remove(id: string): Promise<CategoriaServicioEntity> {
    assertStrictObjectIdOrNotFound(id, 'Categoría');
    const tenantId = this.tenantContext.getTenantId();

    const existing = await this.categoriaModel
      .findOne({ _id: id, tenantId })
      .exec();
    if (!existing) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    const activeItems = await this.servicioModel
      .countDocuments({
        tenantId,
        categoriaId: existing._id,
        activo: { $ne: false },
      })
      .exec();

    if (activeItems > 0) {
      throw new ConflictException(
        'No se puede dar de baja: hay ítems activos asociados a esta categoría',
      );
    }

    const categoria = await this.categoriaModel
      .findOneAndUpdate(
        { _id: id, tenantId },
        { $set: { activo: false } },
        { new: true },
      )
      .exec();
    if (!categoria) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }
    return categoria;
  }
}
