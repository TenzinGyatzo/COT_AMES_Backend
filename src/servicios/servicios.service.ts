import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Servicio, ServicioDocument } from './schemas/servicio.schema';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { CreateServicioGlobalDto } from './dto/create-servicio-global.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';
import { FilterServicioDto } from './dto/filter-servicio.dto';
import { SedesService } from '../sedes/sedes.service';
import { SedeDocument } from '../sedes/schemas/sede.schema';

@Injectable()
export class ServiciosService {
  constructor(
    @InjectModel(Servicio.name) private servicioModel: Model<ServicioDocument>,
    private sedesService: SedesService,
  ) {}

  async create(createServicioDto: CreateServicioDto): Promise<Servicio> {
    // Validar que la sede exista y obtener su información
    const sede = await this.sedesService.findOne(createServicioDto.sedeId);

    try {
      const servicioData = {
        ...createServicioDto,
        claveSede: (sede as unknown as SedeDocument).clave,
      };
      const servicio = new this.servicioModel(servicioData);
      return await servicio.save();
    } catch {
      throw new BadRequestException('Error al crear el servicio');
    }
  }

  async createForAllSedes(
    createServicioGlobalDto: CreateServicioGlobalDto,
  ): Promise<Servicio[]> {
    try {
      // Obtener todas las sedes activas
      const sedes = await this.sedesService.findAll();

      if (sedes.length === 0) {
        throw new BadRequestException(
          'No hay sedes disponibles para crear el servicio',
        );
      }

      // Crear el servicio para cada sede
      const serviciosCreados: Servicio[] = [];

      for (const sede of sedes) {
        // Los documentos de Mongoose tienen _id como parte del Document
        const sedeDoc = sede as unknown as SedeDocument;
        const sedeId =
          sedeDoc._id instanceof Types.ObjectId
            ? sedeDoc._id.toString()
            : String(sedeDoc._id);

        if (!sedeId) {
          continue; // Saltar sedes sin ID válido
        }

        const servicioData = {
          sedeId,
          claveSede: sedeDoc.clave,
          nombre: createServicioGlobalDto.nombre,
          descripcion: createServicioGlobalDto.descripcion,
          precioUnitario: createServicioGlobalDto.precioUnitario,
          moneda: createServicioGlobalDto.moneda || 'MXN',
          activo:
            createServicioGlobalDto.activo !== undefined
              ? createServicioGlobalDto.activo
              : true,
        };

        const servicio = new this.servicioModel(servicioData);
        const servicioGuardado = await servicio.save();
        serviciosCreados.push(servicioGuardado);
      }

      if (serviciosCreados.length === 0) {
        throw new BadRequestException(
          'No se pudo crear el servicio en ninguna sede',
        );
      }

      return serviciosCreados;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'Error al crear el servicio en todas las sedes',
      );
    }
  }

  async findAll(filters?: FilterServicioDto): Promise<Servicio[]> {
    const query: any = {};

    if (filters?.sedeId) {
      query.sedeId = filters.sedeId;
    }

    if (filters?.activo !== undefined) {
      query.activo = filters.activo;
    }

    return await this.servicioModel.find(query).populate('sedeId').exec();
  }

  async findOne(id: string): Promise<Servicio> {
    const servicio = await this.servicioModel
      .findById(id)
      .populate('sedeId')
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
    // Si se actualiza sedeId, validar que exista y obtener su clave
    const updateData: any = { ...updateServicioDto };

    if (updateServicioDto.sedeId) {
      const sede = await this.sedesService.findOne(updateServicioDto.sedeId);
      updateData.claveSede = (sede as unknown as SedeDocument).clave;
    }

    const servicio = await this.servicioModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('sedeId')
      .exec();
    if (!servicio) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }
    return servicio;
  }

  async toggleActivo(id: string): Promise<Servicio> {
    const servicio = await this.servicioModel.findById(id).exec();
    if (!servicio) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }
    servicio.activo = !servicio.activo;
    return await servicio.save();
  }

  async remove(id: string): Promise<void> {
    const servicio = await this.servicioModel.findByIdAndDelete(id).exec();
    if (!servicio) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }
  }
}
