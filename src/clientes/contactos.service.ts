import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Contacto, ContactoDocument } from './schemas/contacto.schema';
import { CreateContactoDto } from './dto/create-contacto.dto';
import { UpdateContactoDto } from './dto/update-contacto.dto';
import { FilterContactoDto } from './dto/filter-contacto.dto';
import { PaginatedContactosResponseDto } from './dto/paginated-contactos-response.dto';
import { ClientesService } from './clientes.service';
import { TenantContextService } from '../tenants/tenant-context.service';
import { assertStrictObjectIdOrNotFound } from '../common/strict-object-id';

@Injectable()
export class ContactosService {
  constructor(
    @InjectModel(Contacto.name)
    private contactoModel: Model<ContactoDocument>,
    private clientesService: ClientesService,
    private tenantContext: TenantContextService,
  ) {}

  private escapeRegex(term: string): string {
    return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private optionalText(
    value: string | null | undefined,
  ): string | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return undefined;
    const t = value.trim();
    return t || undefined;
  }

  private optionalEmail(
    value: string | null | undefined,
  ): string | undefined {
    const t = this.optionalText(value);
    return t ? t.toLowerCase() : undefined;
  }

  /** Cliente del tenant o 404. SHOULD: rechaza si cliente inactivo en create. */
  private async assertCliente(
    clienteId: string,
    opts?: { requireActivo?: boolean },
  ) {
    assertStrictObjectIdOrNotFound(clienteId, 'Cliente');
    const cliente = (await this.clientesService.findOne(clienteId)) as {
      activo?: boolean;
    };
    if (opts?.requireActivo && cliente.activo === false) {
      throw new BadRequestException(
        'No se puede agregar un contacto a un cliente inactivo',
      );
    }
    return cliente;
  }

  async create(
    clienteId: string,
    dto: CreateContactoDto,
  ): Promise<Contacto> {
    await this.assertCliente(clienteId, { requireActivo: true });
    const tenantId = this.tenantContext.getTenantId();
    const nombre = (dto.nombre || '').trim();
    if (!nombre) {
      throw new BadRequestException(
        'Debe proporcionar el nombre del contacto',
      );
    }

    const correo = this.optionalEmail(dto.correo ?? undefined);
    const telefono = this.optionalText(dto.telefono ?? undefined);
    const cargo = this.optionalText(dto.cargo ?? undefined);

    try {
      const doc = new this.contactoModel({
        tenantId,
        clienteId: new Types.ObjectId(clienteId),
        nombre,
        ...(correo ? { correo } : {}),
        ...(telefono ? { telefono } : {}),
        ...(cargo ? { cargo } : {}),
        activo: true,
      });
      return await doc.save();
    } catch {
      throw new BadRequestException('Error al crear el contacto');
    }
  }

  async findAll(
    clienteId: string,
    filters?: FilterContactoDto,
  ): Promise<PaginatedContactosResponseDto> {
    await this.assertCliente(clienteId);
    const tenantId = this.tenantContext.getTenantId();
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters?.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;

    const matchConditions: Record<string, unknown> = {
      tenantId,
      clienteId: new Types.ObjectId(clienteId),
    };

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
      this.contactoModel
        .find(matchConditions)
        .sort({ nombre: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.contactoModel.countDocuments(matchConditions).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit) || 1),
    };
  }

  async findOne(clienteId: string, id: string): Promise<Contacto> {
    await this.assertCliente(clienteId);
    assertStrictObjectIdOrNotFound(id, 'Contacto');
    const tenantId = this.tenantContext.getTenantId();
    const contacto = await this.contactoModel
      .findOne({
        _id: id,
        tenantId,
        clienteId: new Types.ObjectId(clienteId),
      })
      .exec();
    if (!contacto) {
      throw new NotFoundException(`Contacto con ID ${id} no encontrado`);
    }
    return contacto;
  }

  async update(
    clienteId: string,
    id: string,
    dto: UpdateContactoDto,
  ): Promise<Contacto> {
    await this.assertCliente(clienteId);
    assertStrictObjectIdOrNotFound(id, 'Contacto');
    const tenantId = this.tenantContext.getTenantId();

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};

    if (dto.nombre !== undefined) {
      const nombre = (dto.nombre || '').trim();
      if (!nombre) {
        throw new BadRequestException(
          'Debe proporcionar el nombre del contacto',
        );
      }
      $set.nombre = nombre;
    }

    if (dto.correo !== undefined) {
      const correo = this.optionalEmail(dto.correo);
      if (correo) $set.correo = correo;
      else $unset.correo = 1;
    }

    if (dto.telefono !== undefined) {
      const telefono = this.optionalText(dto.telefono);
      if (telefono) $set.telefono = telefono;
      else $unset.telefono = 1;
    }

    if (dto.cargo !== undefined) {
      const cargo = this.optionalText(dto.cargo);
      if (cargo) $set.cargo = cargo;
      else $unset.cargo = 1;
    }

    if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
      return this.findOne(clienteId, id);
    }

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;

    try {
      const contacto = await this.contactoModel
        .findOneAndUpdate(
          {
            _id: id,
            tenantId,
            clienteId: new Types.ObjectId(clienteId),
          },
          update,
          { new: true },
        )
        .exec();
      if (!contacto) {
        throw new NotFoundException(`Contacto con ID ${id} no encontrado`);
      }
      return contacto;
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      throw new BadRequestException('Error al actualizar el contacto');
    }
  }

  async toggleActivo(clienteId: string, id: string): Promise<Contacto> {
    const contacto = await this.findOne(clienteId, id);
    const doc = contacto as ContactoDocument;
    // Ausente/null se trata como activo (alineado a findAll $ne:false)
    const currentlyActive = doc.activo !== false;
    doc.activo = !currentlyActive;
    try {
      return await doc.save();
    } catch {
      throw new BadRequestException('Error al cambiar el estado del contacto');
    }
  }

  async remove(clienteId: string, id: string): Promise<Contacto> {
    await this.assertCliente(clienteId);
    assertStrictObjectIdOrNotFound(id, 'Contacto');
    const tenantId = this.tenantContext.getTenantId();
    const contacto = await this.contactoModel
      .findOneAndUpdate(
        {
          _id: id,
          tenantId,
          clienteId: new Types.ObjectId(clienteId),
        },
        { $set: { activo: false } },
        { new: true },
      )
      .exec();
    if (!contacto) {
      throw new NotFoundException(`Contacto con ID ${id} no encontrado`);
    }
    return contacto;
  }

  /** Story 7.3 — dashboard Totales.contactos (tenant-wide, sin N+1). */
  async countActive(): Promise<number> {
    const tenantId = this.tenantContext.getTenantId();
    return this.contactoModel
      .countDocuments({ tenantId, activo: { $ne: false } })
      .exec();
  }
}
