import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule'; // Import Cron decorators
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Cotizacion,
  CotizacionDocument,
  ItemCotizacion,
} from './schemas/cotizacion.schema';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { CreateCotizacionAdminDto } from './dto/create-cotizacion-admin.dto';
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
import { Logger, UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import * as crypto from 'crypto';
import { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import { OrdenTrabajo, OrdenTrabajoDocument } from '../ordenes-trabajo/schemas/orden-trabajo.schema';
import { WhatsappService } from '../whatsapp/whatsapp.service';

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
    private whatsappService: WhatsappService,
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

  async createAdminCotizacion(
    createCotizacionAdminDto: CreateCotizacionAdminDto,
  ): Promise<Cotizacion> {
    // Validar que la sede exista
    await this.sedesService.findOne(createCotizacionAdminDto.sedeId);

    // Obtener servicios y crear items con snapshots
    const items: ItemCotizacion[] = [];
    let total = 0;

    for (const itemDto of createCotizacionAdminDto.items) {
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
    const fechaVencimiento = createCotizacionAdminDto.fechaVencimiento
      ? new Date(createCotizacionAdminDto.fechaVencimiento)
      : new Date(fechaCreacion.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 días por defecto

    // Calcular estado inicial
    const estado = fechaVencimiento < fechaCreacion ? 'vencida' : 'vigente';
    const fechaEstado = fechaCreacion;

    // Generar Magic Token si se envía por email
    let magicToken: string | undefined;
    let magicTokenExpiresAt: Date | undefined;

    if (createCotizacionAdminDto.enviarEmail && createCotizacionAdminDto.emailContacto) {
      magicToken = crypto.randomBytes(32).toString('hex');
      // Expira junto con la cotización (fechaVencimiento)
      magicTokenExpiresAt = fechaVencimiento;
    }

    try {
      const cotizacionData: any = {
        folio,
        // No establecer clienteId ni usuarioClienteId para cotizaciones guest
        nombreEmpresa: createCotizacionAdminDto.nombreEmpresa,
        nombreContacto: createCotizacionAdminDto.nombreContacto,
        emailContacto: createCotizacionAdminDto.emailContacto || '',
        telefonoContacto: createCotizacionAdminDto.telefonoContacto,
        personasAEvaluar: createCotizacionAdminDto.personasAEvaluar,
        sedeId: createCotizacionAdminDto.sedeId,
        items,
        total,
        moneda: createCotizacionAdminDto.moneda || 'MXN',
        fechaCreacion,
        fechaVencimiento,
        estado,
        magicToken,
        magicTokenExpiresAt,
      };

      // Agregar timestamp del estado inicial
      if (estado === 'vigente') {
        cotizacionData.fechaEstadoVigente = fechaEstado;
      } else {
        cotizacionData.fechaEstadoVencida = fechaEstado;
      }

      const cotizacion = new this.cotizacionModel(cotizacionData);
      const savedCotizacion = await cotizacion.save();

      // Si se solicita enviar email y hay un correo válido, enviar la cotización
      if (
        createCotizacionAdminDto.enviarEmail &&
        createCotizacionAdminDto.emailContacto
      ) {
        try {
          // Obtener detalle completo para el PDF (con sede poblada)
          const cotizacionCompleta = await this.findOne(savedCotizacion._id.toString());
          
          // Generar PDF y enviar email
          const pdfBuffer = await this.pdfService.generatePdfBuffer(cotizacionCompleta);
          
          await this.emailService.sendAdminQuotationEmail(
            createCotizacionAdminDto.emailContacto,
            createCotizacionAdminDto.nombreContacto,
            folio,
            pdfBuffer,
            magicToken,
          );
          
          this.logger.log(
            `Email de cotización ${folio} enviado a ${createCotizacionAdminDto.emailContacto}`,
          );
        } catch (emailError) {
          this.logger.error(
            `Error al generar PDF o enviar email para cotización ${folio}: ${emailError.message}`,
          );
          // No lanzamos excepción para no revertir la creación de la cotización
          // pero dejamos rastro en el log.
        }
      }

      return savedCotizacion;
    } catch (error) {
      this.logger.error(
        `Error al crear cotización admin: ${error.message}`,
        error.stack,
      );
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
        { nombreEmpresa: searchRegex }, // Búsqueda en nombreEmpresa (guest)
        { nombreContacto: searchRegex }, // Búsqueda en nombreContacto (guest)
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
        // Usar $ifNull para fallback a campos guest si no hay cliente/usuario
        empresa: { $ifNull: ['$cliente.empresa', '$nombreEmpresa'] },
        nombreSolicitante: {
          $ifNull: ['$usuarioCliente.nombre', '$nombreContacto'],
        },
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

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.debug('Ejecutando tarea programada: Marcar cotizaciones vencidas');
    const count = await this.markExpiredQuotations();
    if (count > 0) {
      this.logger.log(
        `Se marcaron ${count} cotizaciones como vencidas automáticamente`,
      );
    }
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

    // Obtener cotización actualizada
    const cotizacionActualizada = await this.findOne(cotizacionId);

    // Notificar al admin vía WhatsApp (falla silenciosamente si hay error)
    await this.handleWhatsAppNotification(cotizacionActualizada);

    return cotizacionActualizada;
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

  async aceptarCotizacionAdmin(
    cotizacionId: string,
    trabajadores: any[],
    enviarEmail: boolean = false,
  ): Promise<Cotizacion> {
    const cotizacion = await this.findOne(cotizacionId);

    // Validaciones de estado
    if (cotizacion.estado !== 'vigente') {
      throw new BadRequestException(
        `La cotización debe estar en estado 'vigente' para ser aceptada. Estado actual: ${cotizacion.estado}`,
      );
    }

    if (cotizacion.fechaVencimiento < new Date()) {
      throw new BadRequestException(
        'No se puede aceptar una cotización vencida',
      );
    }

    // Validar trabajadores (opcional para admin, pero respetando el límite si se proporcionan)
    if (trabajadores && trabajadores.length > 0) {
      const cantidadServicios = cotizacion.items.reduce(
        (sum, item) => sum + item.cantidad,
        0,
      );

      if (trabajadores.length > cantidadServicios) {
        throw new BadRequestException(
          `La cantidad de trabajadores (${trabajadores.length}) no puede exceder la cantidad de servicios en la cotización (${cantidadServicios})`,
        );
      }
    }

    // Llamar a ordenesTrabajoService con enviarEmail = false (o lo que pida el controller)
    // Pasamos null como usuarioClienteId porque es acción de admin
    await this.ordenesTrabajoService.createFromCotizacion(
      cotizacionId,
      null,
      trabajadores || [],
      enviarEmail,
    );

    return await this.findOne(cotizacionId);
  }

  async rechazarCotizacionAdmin(cotizacionId: string): Promise<Cotizacion> {
    const cotizacion = await this.findOne(cotizacionId);

    if (cotizacion.estado !== 'vigente') {
      throw new BadRequestException(
        `La cotización debe estar en estado 'vigente' para ser rechazada. Estado actual: ${cotizacion.estado}`,
      );
    }

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

  // --- MÉTODOS PÚBLICOS (MAGIC LINK) ---

  async findOneByMagicToken(token: string): Promise<Cotizacion> {
    const cotizacion = await this.cotizacionModel
      .findOne({ magicToken: token })
      .populate('sedeId')
      .populate('items.servicioId')
      .exec();

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada o enlace inválido');
    }

    // Verificar expiración
    if (cotizacion.magicTokenExpiresAt && cotizacion.magicTokenExpiresAt < new Date()) {
      throw new UnauthorizedException('El enlace ha expirado (vigencia de 30 días superada)');
    }

    return cotizacion;
  }

  async aceptarCotizacionByMagicToken(
    token: string,
    trabajadores: any[],
  ): Promise<Cotizacion> {
    const cotizacion = await this.findOneByMagicToken(token);

    if (cotizacion.estado !== 'vigente') {
      throw new BadRequestException(
        `La cotización no puede ser aceptada. Estado actual: ${cotizacion.estado}`,
      );
    }

    if (!trabajadores || trabajadores.length === 0) {
      throw new BadRequestException('Debe proporcionar la información de los trabajadores');
    }

    const cantidadServicios = cotizacion.items.reduce((sum, item) => sum + item.cantidad, 0);
    if (trabajadores.length > cantidadServicios) {
      throw new BadRequestException(
        `La cantidad de trabajadores (${trabajadores.length}) no puede exceder la cantidad de servicios (${cantidadServicios})`,
      );
    }

    // Aceptar mediante el servicio de órdenes (como admin pero marcar como guest)
    await this.ordenesTrabajoService.createFromCotizacion(
      (cotizacion as any)._id.toString(),
      null, // No hay usuarioClienteId
      trabajadores,
      true, // Enviar email de confirmación
    );

    // Limpiar token para que no se use de nuevo
    await this.cotizacionModel.findByIdAndUpdate((cotizacion as any)._id, {
      $unset: { magicToken: 1, magicTokenExpiresAt: 1 }
    });

    const cotizacionActualizada = await this.findOne((cotizacion as any)._id.toString());

    // Notificar al admin vía WhatsApp (falla silenciosamente si hay error)
    await this.handleWhatsAppNotification(cotizacionActualizada);

    return cotizacionActualizada;
  }

  async rechazarCotizacionByMagicToken(token: string): Promise<Cotizacion> {
    const cotizacion = await this.findOneByMagicToken(token);

    if (cotizacion.estado !== 'vigente') {
      throw new BadRequestException(
        `La cotización no puede ser rechazada. Estado actual: ${cotizacion.estado}`,
      );
    }

    const fechaRechazo = new Date();
    const cotizacionActualizada = await this.cotizacionModel.findByIdAndUpdate(
      (cotizacion as any)._id,
      {
        estado: 'rechazada',
        fechaRechazo,
        fechaEstadoRechazada: fechaRechazo,
        $unset: { magicToken: 1, magicTokenExpiresAt: 1 } // Limpiar token
      },
      { new: true }
    ).exec();

    return cotizacionActualizada;
  }

  /**
   * Maneja el envío de notificaciones de WhatsApp cuando una cotización es aceptada.
   * Este método es resiliente y no arroja errores que interrumpan el flujo principal.
   */
  private async handleWhatsAppNotification(cotizacion: any): Promise<void> {
    try {
      let clienteNombre = 'Cliente Desconocido';

      // 1. Intentar obtener de clienteId (poblado o ID)
      if (cotizacion.clienteId) {
        let cliente = cotizacion.clienteId;

        // Si es un ID (no poblado), intentar cargarlo para obtener datos de empresa
        if (
          typeof cliente === 'string' ||
          cliente instanceof Types.ObjectId ||
          (cliente && cliente._id && Object.keys(cliente).length === 1)
        ) {
          try {
            const clienteIdStr =
              typeof cliente === 'string' ? cliente : cliente.toString();
            cliente = await this.clientesService.findOne(clienteIdStr);
          } catch (e) {
            this.logger.warn(
              `No se pudo cargar cliente info para notificación: ${e.message}`,
            );
          }
        }

        // Si tenemos el objeto cliente (ya sea poblado originalmente o cargado recién)
        if (cliente && typeof cliente === 'object') {
          // Según schema Cliente: empresa. 
          // Agregamos fallbacks por si acaso el schema cambiara o tuviera datos dinámicos.
          clienteNombre = cliente.empresa || cliente.nombreContacto || cliente.email || clienteNombre;
        }
      }

      // 2. Si sigue sin identificarse, intentar con campos de cotización Guest (Usuario no registrado)
      // Verificados en CotizacionSchema: nombreEmpresa, nombreContacto, emailContacto
      if (clienteNombre === 'Cliente Desconocido') {
        clienteNombre =
          cotizacion.nombreEmpresa ||
          cotizacion.nombreContacto ||
          cotizacion.emailContacto ||
          clienteNombre;
      }

      // 3. Fallback final robusto solicitado
      if (clienteNombre === 'Cliente Desconocido' && cotizacion.emailContacto) {
        clienteNombre = cotizacion.emailContacto;
      }

      const notificationData = {
        folio: cotizacion.folio,
        clienteNombre,
        total: cotizacion.total,
        currency: cotizacion.moneda || 'MXN',
      };

      const result =
        await this.whatsappService.sendCotizacionAceptadaNotification(
          notificationData,
        );

      if (!result.success) {
        this.logger.warn(
          `No se pudo enviar notificación de WhatsApp para cotización ${cotizacion.folio}: ${result.error}`,
        );
      } else {
        this.logger.log(
          `Notificación de WhatsApp enviada exitosamente para ${cotizacion.folio}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error inesperado en handleWhatsAppNotification para ${cotizacion.folio}: ${error.message}`,
      );
    }
  }
}
