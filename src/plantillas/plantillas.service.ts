import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Plantilla,
  PlantillaDocument,
  SeccionPlantillaV1,
} from './schemas/plantilla.schema';
import { TenantsService } from '../tenants/tenants.service';
import { TenantContextService } from '../tenants/tenant-context.service';
import {
  PLANTILLAS_SEED,
  buildSeedInsertPayload,
} from './constants/plantillas-seed';
import { assertStrictObjectIdOrNotFound } from '../common/strict-object-id';
import { CreatePlantillaDto } from './dto/create-plantilla.dto';
import { UpdatePlantillaDto } from './dto/update-plantilla.dto';
import { FilterPlantillaDto } from './dto/filter-plantilla.dto';
import { PaginatedPlantillasResponseDto } from './dto/paginated-plantillas-response.dto';
import { plainTextFromTipTapDoc } from './utils/tiptap-plain-text';

@Injectable()
export class PlantillasService implements OnModuleInit {
  private readonly logger = new Logger(PlantillasService.name);

  constructor(
    @InjectModel(Plantilla.name)
    private plantillaModel: Model<PlantillaDocument>,
    private tenantsService: TenantsService,
    private tenantContext: TenantContextService,
  ) {}

  private escapeRegex(term: string): string {
    return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Defensa en profundidad (DTO ya valida en HTTP).
   * Público para reuso en snapshot de cotización (Story 6.5).
   */
  assertSeccionesValidas(secciones: unknown): SeccionPlantillaV1[] {
    if (!Array.isArray(secciones) || secciones.length < 1) {
      throw new BadRequestException('Debe incluir al menos una sección');
    }
    const seenIds = new Set<string>();
    for (const raw of secciones) {
      if (!raw || typeof raw !== 'object') {
        throw new BadRequestException('Cada sección debe ser un objeto');
      }
      const s = raw as Record<string, unknown>;
      if (typeof s.id !== 'string' || !s.id.trim()) {
        throw new BadRequestException('Cada sección requiere id');
      }
      const id = s.id.trim();
      if (seenIds.has(id)) {
        throw new BadRequestException(
          'Los id de sección deben ser únicos dentro de la plantilla',
        );
      }
      seenIds.add(id);
      if (s.tipo === 'richtext') {
        const cuerpo = s.cuerpo as { text?: unknown; doc?: unknown } | undefined;
        if (!cuerpo || typeof cuerpo.text !== 'string') {
          throw new BadRequestException(
            'Sección richtext requiere cuerpo.text',
          );
        }
        if (
          cuerpo.doc !== undefined &&
          (typeof cuerpo.doc !== 'object' ||
            cuerpo.doc === null ||
            Array.isArray(cuerpo.doc))
        ) {
          throw new BadRequestException(
            'cuerpo.doc debe ser un objeto JSON TipTap',
          );
        }
        if (cuerpo.doc !== undefined) {
          const derived = plainTextFromTipTapDoc(cuerpo.doc);
          if (derived !== cuerpo.text) {
            throw new BadRequestException(
              'cuerpo.text debe coincidir con el contenido de cuerpo.doc',
            );
          }
        }
      } else if (s.tipo === 'tabla') {
        if (!Array.isArray(s.encabezados) || s.encabezados.length < 1) {
          throw new BadRequestException(
            'Sección tabla requiere encabezados (mín. 1)',
          );
        }
        if (!s.encabezados.every((h) => typeof h === 'string')) {
          throw new BadRequestException('encabezados debe ser string[]');
        }
        if (!Array.isArray(s.filas)) {
          throw new BadRequestException('Sección tabla requiere filas[]');
        }
        const colCount = s.encabezados.length;
        for (const row of s.filas) {
          if (!Array.isArray(row)) {
            throw new BadRequestException(
              'Cada fila de filas debe ser un arreglo',
            );
          }
          if (row.length !== colCount) {
            throw new BadRequestException(
              `Cada fila debe tener ${colCount} celdas (mismo número que encabezados)`,
            );
          }
          if (!row.every((c) => typeof c === 'string')) {
            throw new BadRequestException(
              'Cada celda de filas debe ser string',
            );
          }
        }
      } else {
        throw new BadRequestException(
          "tipo de sección debe ser 'richtext' o 'tabla'",
        );
      }
    }
    return secciones as SeccionPlantillaV1[];
  }

  async onModuleInit() {
    await this.ensureSeededForAllTenants();
  }

  /**
   * Story 5.1 — seed idempotente por tenant.
   * 1) ensure tenants 2) upsert solo $setOnInsert (no pisa ediciones).
   */
  async ensureSeededForAllTenants(): Promise<Plantilla[]> {
    const tenants = await this.tenantsService.ensureSeeded();
    const createdOrExisting: Plantilla[] = [];

    for (const tenant of tenants) {
      const tenantId = (tenant as any)._id as Types.ObjectId;
      for (const seed of PLANTILLAS_SEED) {
        const doc = await this.plantillaModel
          .findOneAndUpdate(
            { tenantId, claveSeed: seed.claveSeed },
            { $setOnInsert: buildSeedInsertPayload(tenantId, seed) },
            { upsert: true, new: true },
          )
          .exec();
        createdOrExisting.push(doc);
      }
    }

    this.logger.log(
      `Plantillas seed OK: ${tenants.length} tenant(s) × ${PLANTILLAS_SEED.length} seed(s)`,
    );
    return createdOrExisting;
  }

  async findAll(
    filters?: FilterPlantillaDto,
  ): Promise<PaginatedPlantillasResponseDto> {
    const tenantId = this.tenantContext.getTenantId();
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters?.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;

    const matchConditions: Record<string, unknown> = { tenantId };

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

    const [data, total] = await Promise.all([
      this.plantillaModel
        .find(matchConditions)
        .sort({ nombre: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.plantillaModel.countDocuments(matchConditions).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit) || 1),
    };
  }

  async findOne(id: string): Promise<Plantilla> {
    assertStrictObjectIdOrNotFound(id, 'Plantilla');
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.plantillaModel
      .findOne({ _id: id, tenantId })
      .exec();
    if (!doc) {
      throw new NotFoundException(`Plantilla con ID ${id} no encontrada`);
    }
    return doc;
  }

  async create(dto: CreatePlantillaDto): Promise<Plantilla> {
    const tenantId = this.tenantContext.getTenantId();
    const nombre = dto.nombre?.trim();
    if (!nombre) {
      throw new BadRequestException(
        'Debe proporcionar el nombre de la plantilla',
      );
    }
    const secciones = this.assertSeccionesValidas(dto.secciones);

    const doc = new this.plantillaModel({
      tenantId,
      nombre,
      schemaVersion: 1,
      secciones,
      activo: dto.activo !== undefined ? dto.activo : true,
      // sin claveSeed → plantilla custom
    });
    return await doc.save();
  }

  async update(id: string, dto: UpdatePlantillaDto): Promise<Plantilla> {
    assertStrictObjectIdOrNotFound(id, 'Plantilla');
    const tenantId = this.tenantContext.getTenantId();

    const $set: Record<string, unknown> = {};
    if (dto.nombre !== undefined) {
      if (typeof dto.nombre !== 'string') {
        throw new BadRequestException(
          'Debe proporcionar el nombre de la plantilla',
        );
      }
      const nombre = dto.nombre.trim();
      if (!nombre) {
        throw new BadRequestException(
          'Debe proporcionar el nombre de la plantilla',
        );
      }
      $set.nombre = nombre;
    }
    if (dto.secciones !== undefined) {
      $set.secciones = this.assertSeccionesValidas(dto.secciones);
    }
    if (dto.activo !== undefined) {
      $set.activo = dto.activo;
    }

    const doc = await this.plantillaModel
      .findOneAndUpdate({ _id: id, tenantId }, { $set }, { new: true })
      .exec();
    if (!doc) {
      throw new NotFoundException(`Plantilla con ID ${id} no encontrada`);
    }
    return doc;
  }

  async toggleActivo(id: string): Promise<Plantilla> {
    const plantilla = await this.findOne(id);
    const doc = plantilla as PlantillaDocument;
    const currentlyActive = doc.activo !== false;
    doc.activo = !currentlyActive;
    return await doc.save();
  }

  async remove(id: string): Promise<Plantilla> {
    assertStrictObjectIdOrNotFound(id, 'Plantilla');
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.plantillaModel
      .findOneAndUpdate(
        { _id: id, tenantId },
        { $set: { activo: false } },
        { new: true },
      )
      .exec();
    if (!doc) {
      throw new NotFoundException(`Plantilla con ID ${id} no encontrada`);
    }
    return doc;
  }
}
