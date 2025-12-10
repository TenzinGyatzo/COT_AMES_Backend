import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Cotizacion,
  CotizacionDocument,
  ItemCotizacion,
} from './schemas/cotizacion.schema';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto';
import { FilterCotizacionDto } from './dto/filter-cotizacion.dto';
import { FilterMisCotizacionesDto } from './dto/filter-mis-cotizaciones.dto';
import { CreateCotizacionClienteDto } from './dto/create-cotizacion-cliente.dto';
import { PaginatedCotizacionesResponseDto } from './dto/paginated-cotizaciones-response.dto';
import { CotizacionListItemDto } from './dto/cotizacion-list-item.dto';
import { ClientesService } from '../clientes/clientes.service';
import { ServiciosService } from '../servicios/servicios.service';
import { SedesService } from '../sedes/sedes.service';
import { EmailService } from './services/email.service';
import { PdfService } from './services/pdf.service';
import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import {
  OrdenTrabajo,
  OrdenTrabajoDocument,
} from '../ordenes-trabajo/schemas/orden-trabajo.schema';

@Injectable()
export class CotizacionesService {
  private readonly logger = new Logger(CotizacionesService.name);

  constructor(
    @InjectModel(Cotizacion.name)
    private cotizacionModel: Model<CotizacionDocument>,
    @InjectModel(OrdenTrabajo.name)
    private ordenTrabajoModel: Model<OrdenTrabajoDocument>,
    private clientesService: ClientesService,
    private serviciosService: ServiciosService,
    private sedesService: SedesService,
    private emailService: EmailService,
    private pdfService: PdfService,
    @Inject(forwardRef(() => OrdenesTrabajoService))
    private ordenesTrabajoService: OrdenesTrabajoService,
  ) {}

  async generateFolio(): Promise<string> {
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const count = await this.cotizacionModel.countDocuments({
      fechaCreacion: {
        $gte: startOfYear,
        $lte: endOfYear,
      },
    });

    const sequential = (count + 1).toString().padStart(4, '0');
    return `COT-${year}-${sequential}`;
  }

  async create(createCotizacionDto: CreateCotizacionDto): Promise<Cotizacion> {
    // Validar que cliente, sede y servicios existan
    await this.clientesService.findOne(createCotizacionDto.clienteId);
    await this.sedesService.findOne(createCotizacionDto.sedeId);

    // Obtener servicios y crear items con snapshots
    const items: ItemCotizacion[] = [];
    let total = 0;

    for (const itemDto of createCotizacionDto.items) {
      const servicio = await this.serviciosService.findOne(itemDto.servicioId);
      const servicioDoc = servicio as any;

      const subtotal = servicio.precioUnitario * itemDto.cantidad;
      total += subtotal;

      const item: any = {
        servicioId: servicioDoc._id || servicioDoc.id,
        nombreServicioSnapshot: servicio.nombre,
        precioUnitarioSnapshot: servicio.precioUnitario,
        cantidad: itemDto.cantidad,
        subtotal,
      };
      // Incluir descripcionServicioSnapshot solo si el servicio tiene descripción
      // Mongoose omite campos undefined, así que solo lo incluimos si tiene valor
      // Verificar explícitamente que no sea undefined ni null ni cadena vacía
      if (
        servicio.descripcion !== undefined &&
        servicio.descripcion !== null &&
        servicio.descripcion !== ''
      ) {
        item.descripcionServicioSnapshot = servicio.descripcion;
      }

      console.log('[COTIZACION CREATE] Item creado:', {
        servicioId: item.servicioId,
        nombreServicioSnapshot: item.nombreServicioSnapshot,
        descripcionServicioSnapshot: item.descripcionServicioSnapshot,
        descripcionType: typeof item.descripcionServicioSnapshot,
      });

      items.push(item);
    }

    // Generar folio único
    const folio = await this.generateFolio();

    // Calcular fechas
    const fechaCreacion = new Date();
    const fechaVencimiento = createCotizacionDto.fechaVencimiento
      ? new Date(createCotizacionDto.fechaVencimiento)
      : new Date(fechaCreacion.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 días por defecto

    // Calcular estado inicial
    const estado = fechaVencimiento < fechaCreacion ? 'vencida' : 'vigente';
    const fechaEstado = fechaCreacion;

    try {
      const cotizacionData: any = {
        folio,
        clienteId: createCotizacionDto.clienteId,
        sedeId: createCotizacionDto.sedeId,
        emailContacto: createCotizacionDto.emailContacto,
        items,
        total,
        moneda: createCotizacionDto.moneda || 'MXN',
        fechaCreacion,
        fechaVencimiento,
        estado,
      };

      // Agregar timestamp del estado inicial
      if (estado === 'vigente') {
        cotizacionData.fechaEstadoVigente = fechaEstado;
      } else {
        cotizacionData.fechaEstadoVencida = fechaEstado;
      }

      const cotizacion = new this.cotizacionModel(cotizacionData);

      return await cotizacion.save();
    } catch {
      throw new BadRequestException('Error al crear la cotización');
    }
  }

  async findAll(
    filters?: FilterCotizacionDto,
  ): Promise<PaginatedCotizacionesResponseDto> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    // Construir pipeline de agregación
    const pipeline: any[] = [];

    // $lookup para unir con las colecciones relacionadas
    pipeline.push({
      $lookup: {
        from: 'clientes',
        localField: 'clienteId',
        foreignField: '_id',
        as: 'cliente',
      },
    });

    pipeline.push({
      $lookup: {
        from: 'usuarioclientes',
        localField: 'usuarioClienteId',
        foreignField: '_id',
        as: 'usuarioCliente',
      },
    });

    // Convertir sedeId a ObjectId si es necesario antes del lookup
    pipeline.push({
      $addFields: {
        sedeIdConverted: {
          $cond: {
            if: { $eq: [{ $type: '$sedeId' }, 'string'] },
            then: { $toObjectId: '$sedeId' },
            else: '$sedeId',
          },
        },
      },
    });

    pipeline.push({
      $lookup: {
        from: 'sedes',
        localField: 'sedeIdConverted',
        foreignField: '_id',
        as: 'sede',
      },
    });

    // $unwind de las referencias
    pipeline.push({
      $unwind: {
        path: '$cliente',
        preserveNullAndEmptyArrays: true,
      },
    });

    pipeline.push({
      $unwind: {
        path: '$usuarioCliente',
        preserveNullAndEmptyArrays: true,
      },
    });

    pipeline.push({
      $unwind: {
        path: '$sede',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Construir $match para filtros
    const matchConditions: any = {};

    if (filters?.estado) {
      matchConditions.estado = filters.estado;
    }

    if (filters?.sedeId) {
      matchConditions.sedeId = new Types.ObjectId(filters.sedeId);
    }

    if (filters?.fechaDesde || filters?.fechaHasta) {
      matchConditions.fechaCreacion = {};
      if (filters.fechaDesde) {
        matchConditions.fechaCreacion.$gte = new Date(filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        matchConditions.fechaCreacion.$lte = new Date(filters.fechaHasta);
      }
    }

    // Aplicar $match para filtros básicos (antes de búsqueda)
    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Búsqueda por texto en múltiples campos (después de unwinds)
    if (filters?.search) {
      const searchRegex = { $regex: filters.search, $options: 'i' };

      // Mapeo de texto de estado a valor en BD
      const estadoMap: Record<string, string> = {
        vigente: 'vigente',
        vencida: 'vencida',
        aceptada: 'aceptada',
        rechazada: 'rechazada',
      };

      // Normalizar búsqueda para estado (convertir a minúsculas y buscar coincidencias)
      const searchLower = filters.search.toLowerCase().trim();
      const estadoMatch = estadoMap[searchLower];

      const orConditions: any[] = [
        { 'cliente.empresa': searchRegex },
        { 'cliente.rfc': searchRegex },
        { folio: searchRegex },
        { 'sede.ciudad': searchRegex },
        { 'sede.clave': searchRegex },
        { 'usuarioCliente.nombre': searchRegex },
        { 'usuarioCliente.email': searchRegex },
        { emailContacto: searchRegex },
      ];

      // Si la búsqueda coincide con un estado, agregarlo
      if (estadoMatch) {
        orConditions.push({ estado: estadoMatch });
      } else {
        // También buscar por estado con regex (por si escriben "Vigente" con mayúscula)
        orConditions.push({ estado: searchRegex });
      }

      pipeline.push({
        $match: {
          $or: orConditions,
        },
      });
    }

    // Pipeline para contar total (antes de paginación)
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await this.cotizacionModel.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Ordenar por fecha de creación descendente (más reciente primero)
    pipeline.push({ $sort: { fechaCreacion: -1 } });

    // Agregar paginación
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Proyectar campos necesarios para la respuesta
    pipeline.push({
      $project: {
        _id: 1,
        folio: 1,
        fecha: '$fechaCreacion',
        montoTotal: '$total',
        empresa: '$cliente.empresa',
        nombreSolicitante: '$usuarioCliente.nombre',
        sede: '$sede.ciudad',
        rfc: '$cliente.rfc',
        estado: 1,
        pdfUrl: 1,
        fechaAceptacion: 1,
        fechaRechazo: 1,
        ordenTrabajoId: 1,
      },
    });

    // Ejecutar agregación
    const results = await this.cotizacionModel.aggregate(pipeline).exec();

    // Formatear resultados
    const data: CotizacionListItemDto[] = results.map((item) => ({
      id: item._id.toString(),
      folio: item.folio,
      fecha: item.fecha,
      montoTotal: item.montoTotal,
      empresa: item.empresa,
      nombreSolicitante: item.nombreSolicitante,
      sede: item.sede,
      rfc: item.rfc,
      estado: item.estado,
      pdfUrl: item.pdfUrl,
      fechaAceptacion: item.fechaAceptacion,
      fechaRechazo: item.fechaRechazo,
      ordenTrabajoId: item.ordenTrabajoId?.toString(),
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(
    id: string,
  ): Promise<Cotizacion & { ordenTrabajoFolio?: string }> {
    // Asegurar que id sea un ObjectId válido
    const cotizacionObjectId = new Types.ObjectId(id);

    const cotizacion = await this.cotizacionModel
      .findById(cotizacionObjectId)
      .populate('clienteId')
      .populate('usuarioClienteId')
      .populate('sedeId')
      .populate('items.servicioId')
      .exec();
    if (!cotizacion) {
      throw new NotFoundException(`Cotización con ID ${id} no encontrada`);
    }

    // Si existe ordenTrabajoId, obtener el folio de la orden de trabajo
    if (cotizacion.ordenTrabajoId) {
      try {
        const ordenTrabajoId =
          typeof cotizacion.ordenTrabajoId === 'string'
            ? new Types.ObjectId(cotizacion.ordenTrabajoId)
            : cotizacion.ordenTrabajoId;
        const ordenTrabajo = await this.ordenTrabajoModel
          .findById(ordenTrabajoId)
          .select('folio')
          .lean()
          .exec();
        if (ordenTrabajo && ordenTrabajo.folio) {
          // Agregar el folio como propiedad adicional al objeto
          const cotizacionObj = cotizacion.toObject();
          return {
            ...cotizacionObj,
            ordenTrabajoFolio: ordenTrabajo.folio,
          } as Cotizacion & { ordenTrabajoFolio?: string };
        }
      } catch (error) {
        // Si no se encuentra la orden de trabajo, continuar sin el folio
        this.logger.warn(
          `No se pudo obtener el folio de la orden de trabajo ${cotizacion.ordenTrabajoId}: ${error}`,
        );
      }
    }

    return cotizacion;
  }

  async update(
    id: string,
    updateCotizacionDto: UpdateCotizacionDto,
  ): Promise<Cotizacion> {
    const updateData: any = { ...updateCotizacionDto };
    const ahora = new Date();

    // Si se actualiza fechaVencimiento, recalcular estado
    if (updateCotizacionDto.fechaVencimiento) {
      const fechaVencimiento = new Date(updateCotizacionDto.fechaVencimiento);
      const nuevoEstado = fechaVencimiento < new Date() ? 'vencida' : 'vigente';
      updateData.estado = nuevoEstado;
      // Guardar timestamp del cambio de estado
      if (nuevoEstado === 'vigente') {
        updateData.fechaEstadoVigente = ahora;
      } else {
        updateData.fechaEstadoVencida = ahora;
      }
    }

    // Si se actualiza el estado directamente, guardar timestamp
    if (updateCotizacionDto.estado) {
      switch (updateCotizacionDto.estado) {
        case 'vigente':
          updateData.fechaEstadoVigente = ahora;
          break;
        case 'vencida':
          updateData.fechaEstadoVencida = ahora;
          break;
        case 'aceptada':
          updateData.fechaEstadoAceptada = ahora;
          break;
        case 'rechazada':
          updateData.fechaEstadoRechazada = ahora;
          break;
      }
    }

    const cotizacion = await this.cotizacionModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('clienteId')
      .populate('sedeId')
      .populate('items.servicioId')
      .exec();
    if (!cotizacion) {
      throw new NotFoundException(`Cotización con ID ${id} no encontrada`);
    }
    return cotizacion;
  }

  async marcarVencida(id: string): Promise<Cotizacion> {
    const ahora = new Date();
    return await this.update(id, {
      estado: 'vencida',
      fechaEstadoVencida: ahora,
    });
  }

  async markExpiredQuotations(): Promise<number> {
    const fechaActual = new Date();
    const resultado = await this.cotizacionModel
      .updateMany(
        {
          fechaVencimiento: { $lt: fechaActual },
          estado: 'vigente',
        },
        {
          $set: {
            estado: 'vencida',
            fechaEstadoVencida: fechaActual,
          },
        },
      )
      .exec();

    return resultado.modifiedCount;
  }

  async findByClienteId(
    clienteId: string,
    filters?: FilterMisCotizacionesDto,
  ): Promise<PaginatedCotizacionesResponseDto> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    // Construir pipeline de agregación
    const pipeline: any[] = [];

    // $lookup para unir con la colección de clientes
    pipeline.push({
      $lookup: {
        from: 'clientes',
        localField: 'clienteId',
        foreignField: '_id',
        as: 'cliente',
      },
    });

    // $unwind del cliente
    pipeline.push({
      $unwind: {
        path: '$cliente',
        preserveNullAndEmptyArrays: true,
      },
    });

    // $lookup para unir con la colección de usuarios clientes
    pipeline.push({
      $lookup: {
        from: 'usuarioclientes',
        localField: 'usuarioClienteId',
        foreignField: '_id',
        as: 'usuarioCliente',
      },
    });

    // $unwind del usuario cliente
    pipeline.push({
      $unwind: {
        path: '$usuarioCliente',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Construir $match para filtros - SIEMPRE incluir clienteId
    const matchConditions: any = {
      clienteId: new Types.ObjectId(clienteId),
    };

    if (filters?.estado) {
      matchConditions.estado = filters.estado;
    }

    if (filters?.fechaDesde || filters?.fechaHasta) {
      matchConditions.fechaCreacion = {};
      if (filters.fechaDesde) {
        matchConditions.fechaCreacion.$gte = new Date(filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        matchConditions.fechaCreacion.$lte = new Date(filters.fechaHasta);
      }
    }

    pipeline.push({ $match: matchConditions });

    // Ordenar por fecha de creación descendente (más reciente primero)
    pipeline.push({ $sort: { fechaCreacion: -1 } });

    // Pipeline para contar total (antes de paginación)
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await this.cotizacionModel.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Agregar paginación
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Proyectar campos necesarios para la respuesta
    pipeline.push({
      $project: {
        _id: 1,
        folio: 1,
        fecha: '$fechaCreacion',
        montoTotal: '$total',
        empresa: '$cliente.empresa',
        nombreSolicitante: '$usuarioCliente.nombre',
        rfc: '$cliente.rfc',
        estado: 1,
        pdfUrl: 1,
        fechaAceptacion: 1,
        fechaRechazo: 1,
        ordenTrabajoId: 1,
      },
    });

    // Ejecutar agregación
    const results = await this.cotizacionModel.aggregate(pipeline).exec();

    // Formatear resultados
    const data: CotizacionListItemDto[] = results.map((item) => ({
      id: item._id.toString(),
      folio: item.folio,
      fecha: item.fecha,
      montoTotal: item.montoTotal,
      empresa: item.empresa,
      nombreSolicitante: item.nombreSolicitante,
      rfc: item.rfc,
      estado: item.estado,
      pdfUrl: item.pdfUrl,
      fechaAceptacion: item.fechaAceptacion,
      fechaRechazo: item.fechaRechazo,
      ordenTrabajoId: item.ordenTrabajoId?.toString(),
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findByUsuarioClienteId(
    usuarioClienteId: string,
    clienteId: string,
    filters?: FilterMisCotizacionesDto,
  ): Promise<PaginatedCotizacionesResponseDto> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    // Construir pipeline de agregación
    const pipeline: any[] = [];

    // $lookup para unir con la colección de clientes
    pipeline.push({
      $lookup: {
        from: 'clientes',
        localField: 'clienteId',
        foreignField: '_id',
        as: 'cliente',
      },
    });

    // $unwind del cliente
    pipeline.push({
      $unwind: {
        path: '$cliente',
        preserveNullAndEmptyArrays: true,
      },
    });

    // $lookup para unir con la colección de usuarios clientes
    pipeline.push({
      $lookup: {
        from: 'usuarioclientes',
        localField: 'usuarioClienteId',
        foreignField: '_id',
        as: 'usuarioCliente',
      },
    });

    // $unwind del usuario cliente
    pipeline.push({
      $unwind: {
        path: '$usuarioCliente',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Construir $match para filtros - SIEMPRE incluir clienteId y usuarioClienteId
    const matchConditions: any = {
      clienteId: new Types.ObjectId(clienteId),
      usuarioClienteId: new Types.ObjectId(usuarioClienteId),
    };

    if (filters?.estado) {
      matchConditions.estado = filters.estado;
    }

    if (filters?.fechaDesde || filters?.fechaHasta) {
      matchConditions.fechaCreacion = {};
      if (filters.fechaDesde) {
        matchConditions.fechaCreacion.$gte = new Date(filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        matchConditions.fechaCreacion.$lte = new Date(filters.fechaHasta);
      }
    }

    pipeline.push({ $match: matchConditions });

    // Ordenar por fecha de creación descendente (más reciente primero)
    pipeline.push({ $sort: { fechaCreacion: -1 } });

    // Pipeline para contar total (antes de paginación)
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await this.cotizacionModel.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Agregar paginación
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Proyectar campos necesarios para la respuesta
    pipeline.push({
      $project: {
        _id: 1,
        folio: 1,
        fecha: '$fechaCreacion',
        montoTotal: '$total',
        empresa: '$cliente.empresa',
        nombreSolicitante: '$usuarioCliente.nombre',
        rfc: '$cliente.rfc',
        estado: 1,
        pdfUrl: 1,
        fechaAceptacion: 1,
        fechaRechazo: 1,
        ordenTrabajoId: 1,
      },
    });

    // Ejecutar agregación
    const results = await this.cotizacionModel.aggregate(pipeline).exec();

    // Formatear resultados
    const data: CotizacionListItemDto[] = results.map((item) => ({
      id: item._id.toString(),
      folio: item.folio,
      fecha: item.fecha,
      montoTotal: item.montoTotal,
      empresa: item.empresa,
      nombreSolicitante: item.nombreSolicitante,
      rfc: item.rfc,
      estado: item.estado,
      pdfUrl: item.pdfUrl,
      fechaAceptacion: item.fechaAceptacion,
      fechaRechazo: item.fechaRechazo,
      ordenTrabajoId: item.ordenTrabajoId?.toString(),
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOneByClienteId(
    id: string,
    clienteId: string,
  ): Promise<Cotizacion & { ordenTrabajoFolio?: string }> {
    // Asegurar que id sea un ObjectId válido
    const cotizacionObjectId = new Types.ObjectId(id);
    const clienteObjectId = new Types.ObjectId(clienteId);

    const cotizacion = await this.cotizacionModel
      .findOne({
        _id: cotizacionObjectId,
        clienteId: clienteObjectId,
      })
      .populate('clienteId')
      .populate('sedeId')
      .populate('items.servicioId')
      .exec();

    if (!cotizacion) {
      throw new NotFoundException(
        `Cotización con ID ${id} no encontrada o no pertenece a su empresa`,
      );
    }

    // Si existe ordenTrabajoId, obtener el folio de la orden de trabajo
    if (cotizacion.ordenTrabajoId) {
      try {
        const ordenTrabajoId =
          typeof cotizacion.ordenTrabajoId === 'string'
            ? new Types.ObjectId(cotizacion.ordenTrabajoId)
            : cotizacion.ordenTrabajoId;
        const ordenTrabajo = await this.ordenTrabajoModel
          .findById(ordenTrabajoId)
          .select('folio')
          .lean()
          .exec();
        if (ordenTrabajo && ordenTrabajo.folio) {
          const cotizacionObj = cotizacion.toObject();
          return {
            ...cotizacionObj,
            ordenTrabajoFolio: ordenTrabajo.folio,
          } as Cotizacion & { ordenTrabajoFolio?: string };
        }
      } catch (error) {
        this.logger.warn(
          `No se pudo obtener el folio de la orden de trabajo ${cotizacion.ordenTrabajoId}: ${error}`,
        );
      }
    }

    return cotizacion;
  }

  async findOneByUsuarioClienteId(
    id: string,
    usuarioClienteId: string,
    clienteId: string,
  ): Promise<Cotizacion & { ordenTrabajoFolio?: string }> {
    // Asegurar que todos los IDs sean ObjectIds válidos
    const cotizacionObjectId = new Types.ObjectId(id);
    const clienteObjectId = new Types.ObjectId(clienteId);
    const usuarioClienteObjectId = new Types.ObjectId(usuarioClienteId);

    const cotizacion = await this.cotizacionModel
      .findOne({
        _id: cotizacionObjectId,
        clienteId: clienteObjectId,
        usuarioClienteId: usuarioClienteObjectId,
      })
      .populate('clienteId')
      .populate('usuarioClienteId')
      .populate('sedeId')
      .populate('items.servicioId')
      .exec();

    if (!cotizacion) {
      throw new NotFoundException(
        `Cotización con ID ${id} no encontrada o no pertenece a su usuario`,
      );
    }

    // Si existe ordenTrabajoId, obtener el folio de la orden de trabajo
    if (cotizacion.ordenTrabajoId) {
      try {
        const ordenTrabajoId =
          typeof cotizacion.ordenTrabajoId === 'string'
            ? new Types.ObjectId(cotizacion.ordenTrabajoId)
            : cotizacion.ordenTrabajoId;
        const ordenTrabajo = await this.ordenTrabajoModel
          .findById(ordenTrabajoId)
          .select('folio')
          .lean()
          .exec();
        if (ordenTrabajo && ordenTrabajo.folio) {
          const cotizacionObj = cotizacion.toObject();
          return {
            ...cotizacionObj,
            ordenTrabajoFolio: ordenTrabajo.folio,
          } as Cotizacion & { ordenTrabajoFolio?: string };
        }
      } catch (error) {
        this.logger.warn(
          `No se pudo obtener el folio de la orden de trabajo ${cotizacion.ordenTrabajoId}: ${error}`,
        );
      }
    }

    return cotizacion;
  }

  async createFromCliente(
    clienteId: string,
    dto: CreateCotizacionClienteDto,
    usuarioClienteId?: string,
  ): Promise<Cotizacion> {
    // Validar que el cliente existe
    await this.clientesService.findOne(clienteId);

    // Validar que la sede existe
    await this.sedesService.findOne(dto.sedeId);

    // Obtener servicios y crear items con snapshots
    const items: ItemCotizacion[] = [];
    let total = 0;

    for (const itemDto of dto.items) {
      const servicio = await this.serviciosService.findOne(itemDto.servicioId);
      const servicioDoc = servicio as any;

      const subtotal = servicio.precioUnitario * itemDto.cantidad;
      total += subtotal;

      const item: any = {
        servicioId: servicioDoc._id || servicioDoc.id,
        nombreServicioSnapshot: servicio.nombre,
        precioUnitarioSnapshot: servicio.precioUnitario,
        cantidad: itemDto.cantidad,
        subtotal,
      };
      // Incluir descripcionServicioSnapshot solo si el servicio tiene descripción
      // Mongoose omite campos undefined, así que solo lo incluimos si tiene valor
      // Verificar explícitamente que no sea undefined ni null ni cadena vacía
      if (
        servicio.descripcion !== undefined &&
        servicio.descripcion !== null &&
        servicio.descripcion !== ''
      ) {
        item.descripcionServicioSnapshot = servicio.descripcion;
      }

      items.push(item);
    }

    // Generar folio único
    const folio = await this.generateFolio();

    // Calcular fechas
    const fechaCreacion = new Date();
    const fechaVencimiento = new Date(
      fechaCreacion.getTime() + 30 * 24 * 60 * 60 * 1000,
    ); // 30 días por defecto

    // Calcular estado inicial
    const estado = fechaVencimiento < fechaCreacion ? 'vencida' : 'vigente';

    try {
      const cotizacionData: any = {
        folio,
        clienteId: new Types.ObjectId(clienteId),
        sedeId: dto.sedeId,
        emailContacto: dto.emailContacto,
        items,
        total,
        moneda: 'MXN',
        fechaCreacion,
        fechaVencimiento,
        estado,
      };

      // Agregar usuarioClienteId si se proporciona
      if (usuarioClienteId) {
        cotizacionData.usuarioClienteId = new Types.ObjectId(usuarioClienteId);
      }

      const cotizacion = new this.cotizacionModel(cotizacionData);
      return await cotizacion.save();
    } catch {
      throw new BadRequestException('Error al crear la cotización');
    }
  }

  async repetirCotizacion(
    cotizacionId: string,
    clienteId: string,
    usuarioClienteId?: string,
  ): Promise<Cotizacion> {
    // Buscar la cotización original asegurando que pertenece al usuario específico si se proporciona
    let cotizacionOriginal: Cotizacion;
    if (usuarioClienteId) {
      cotizacionOriginal = await this.findOneByUsuarioClienteId(
        cotizacionId,
        usuarioClienteId,
        clienteId,
      );
    } else {
      // Si no se proporciona usuarioClienteId, validar solo por empresa (compatibilidad con admin)
      cotizacionOriginal = await this.findOneByClienteId(
        cotizacionId,
        clienteId,
      );
    }

    // Obtener servicios actuales y crear items con snapshots actualizados
    const items: ItemCotizacion[] = [];
    let total = 0;

    for (const itemOriginal of cotizacionOriginal.items) {
      const servicioId =
        (itemOriginal.servicioId as any)._id?.toString() ||
        itemOriginal.servicioId.toString();
      const servicio = await this.serviciosService.findOne(servicioId);
      const servicioDoc = servicio as any;

      const subtotal = servicio.precioUnitario * itemOriginal.cantidad;
      total += subtotal;

      const item: any = {
        servicioId: servicioDoc._id || servicioDoc.id,
        nombreServicioSnapshot: servicio.nombre,
        precioUnitarioSnapshot: servicio.precioUnitario,
        cantidad: itemOriginal.cantidad,
        subtotal,
      };
      // Incluir descripcionServicioSnapshot solo si el servicio tiene descripción
      // Mongoose omite campos undefined, así que solo lo incluimos si tiene valor
      // Verificar explícitamente que no sea undefined ni null ni cadena vacía
      if (
        servicio.descripcion !== undefined &&
        servicio.descripcion !== null &&
        servicio.descripcion !== ''
      ) {
        item.descripcionServicioSnapshot = servicio.descripcion;
      }

      items.push(item);
    }

    // Generar nuevo folio
    const folio = await this.generateFolio();

    // Calcular fechas
    const fechaCreacion = new Date();
    const fechaVencimiento = new Date(
      fechaCreacion.getTime() + 30 * 24 * 60 * 60 * 1000,
    ); // 30 días por defecto

    // Estado inicial siempre vigente
    const estado = 'vigente';

    try {
      // Extraer IDs correctamente (pueden estar poblados o ser ObjectIds)
      const cotizacionDoc = cotizacionOriginal as any;
      const clienteIdStr =
        cotizacionDoc.clienteId?._id?.toString() ||
        cotizacionDoc.clienteId?.toString() ||
        cotizacionOriginal.clienteId?.toString();
      const sedeIdStr =
        cotizacionDoc.sedeId?._id?.toString() ||
        cotizacionDoc.sedeId?.toString() ||
        cotizacionOriginal.sedeId?.toString();

      const nuevaCotizacionData: any = {
        folio,
        clienteId: new Types.ObjectId(clienteIdStr),
        sedeId: new Types.ObjectId(sedeIdStr),
        emailContacto: cotizacionOriginal.emailContacto,
        items,
        total,
        moneda: cotizacionOriginal.moneda,
        fechaCreacion,
        fechaVencimiento,
        estado,
      };

      // Usar el usuarioClienteId proporcionado (del usuario que está repitiendo)
      // Si no se proporciona, preservar el de la cotización original
      if (usuarioClienteId) {
        nuevaCotizacionData.usuarioClienteId = new Types.ObjectId(
          usuarioClienteId,
        );
      } else {
        // Preservar usuarioClienteId de la cotización original si existe
        const usuarioIdOriginal =
          cotizacionDoc.usuarioClienteId?._id?.toString() ||
          cotizacionDoc.usuarioClienteId?.toString() ||
          cotizacionOriginal.usuarioClienteId?.toString();
        if (usuarioIdOriginal) {
          nuevaCotizacionData.usuarioClienteId = new Types.ObjectId(
            usuarioIdOriginal,
          );
        }
      }

      const nuevaCotizacion = new this.cotizacionModel(nuevaCotizacionData);

      return await nuevaCotizacion.save();
    } catch {
      throw new BadRequestException('Error al repetir la cotización');
    }
  }

  async aceptarCotizacion(
    cotizacionId: string,
    usuarioClienteId: string,
    clienteId: string,
    trabajadores: any[],
  ): Promise<Cotizacion> {
    // Validar que la cotización existe y pertenece al usuario específico
    const cotizacion = await this.findOneByUsuarioClienteId(
      cotizacionId,
      usuarioClienteId,
      clienteId,
    );

    // Validar que el estado actual es 'vigente'
    if (cotizacion.estado !== 'vigente') {
      throw new BadRequestException(
        `La cotización debe estar en estado 'vigente' para ser aceptada. Estado actual: ${cotizacion.estado}`,
      );
    }

    // Validar que no está vencida (fechaVencimiento >= ahora)
    if (cotizacion.fechaVencimiento < new Date()) {
      throw new BadRequestException(
        'No se puede aceptar una cotización vencida',
      );
    }

    // Validar cantidad de trabajadores
    const cantidadServicios = cotizacion.items.reduce(
      (sum, item) => sum + item.cantidad,
      0,
    );

    if (!trabajadores || trabajadores.length === 0) {
      throw new BadRequestException(
        'Debe agregar al menos un trabajador para aceptar la cotización',
      );
    }

    if (trabajadores.length > cantidadServicios) {
      throw new BadRequestException(
        `La cantidad de trabajadores (${trabajadores.length}) no puede exceder la cantidad de servicios en la cotización (${cantidadServicios})`,
      );
    }

    // Llamar a ordenesTrabajoService.createFromCotizacion
    // Esto actualizará la cotización automáticamente
    await this.ordenesTrabajoService.createFromCotizacion(
      cotizacionId,
      usuarioClienteId,
      trabajadores,
    );

    // Retornar cotización actualizada
    return await this.findOne(cotizacionId);
  }

  async rechazarCotizacion(
    cotizacionId: string,
    clienteId: string,
    usuarioClienteId?: string,
  ): Promise<Cotizacion> {
    // Si se proporciona usuarioClienteId, validar que pertenece al usuario específico
    let cotizacion: Cotizacion;
    if (usuarioClienteId) {
      cotizacion = await this.findOneByUsuarioClienteId(
        cotizacionId,
        usuarioClienteId,
        clienteId,
      );
    } else {
      // Si no se proporciona usuarioClienteId, validar solo por empresa (compatibilidad con admin)
      cotizacion = await this.findOneByClienteId(cotizacionId, clienteId);
    }

    // Validar que el estado actual es 'vigente'
    if (cotizacion.estado !== 'vigente') {
      throw new BadRequestException(
        `La cotización debe estar en estado 'vigente' para ser rechazada. Estado actual: ${cotizacion.estado}`,
      );
    }

    // Actualizar: estado='rechazada', fechaRechazo=now
    const fechaRechazo = new Date();
    const cotizacionActualizada = await this.cotizacionModel
      .findByIdAndUpdate(
        cotizacionId,
        {
          estado: 'rechazada',
          fechaRechazo: fechaRechazo,
          fechaEstadoRechazada: fechaRechazo,
        },
        { new: true },
      )
      .populate('clienteId')
      .populate('sedeId')
      .populate('items.servicioId')
      .exec();

    if (!cotizacionActualizada) {
      throw new NotFoundException(
        `Cotización con ID ${cotizacionId} no encontrada`,
      );
    }

    return cotizacionActualizada;
  }
}
