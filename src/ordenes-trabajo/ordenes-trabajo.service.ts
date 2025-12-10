import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  OrdenTrabajo,
  OrdenTrabajoDocument,
} from './schemas/orden-trabajo.schema';
import {
  Cotizacion,
  CotizacionDocument,
} from '../cotizaciones/schemas/cotizacion.schema';
import { UpdateOrdenTrabajoDto } from './dto/update-orden-trabajo.dto';
import { FilterOrdenTrabajoDto } from './dto/filter-orden-trabajo.dto';
import { PaginatedOrdenesTrabajoResponseDto } from './dto/paginated-ordenes-trabajo-response.dto';
import { OrdenTrabajoListItemDto } from './dto/orden-trabajo-list-item.dto';
import { OrdenTrabajoResponseDto } from './dto/orden-trabajo-response.dto';
import { CreateTrabajadorDto } from './dto/create-trabajador.dto';
import { UpdateTrabajadorDto } from './dto/update-trabajador.dto';
import { ClientesService } from '../clientes/clientes.service';
import { SedesService } from '../sedes/sedes.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';

@Injectable()
export class OrdenesTrabajoService {
  constructor(
    @InjectModel(OrdenTrabajo.name)
    private ordenTrabajoModel: Model<OrdenTrabajoDocument>,
    @InjectModel(Cotizacion.name)
    private cotizacionModel: Model<CotizacionDocument>,
    private clientesService: ClientesService,
    private sedesService: SedesService,
    @Inject(forwardRef(() => CotizacionesService))
    private cotizacionesService: CotizacionesService,
  ) {}

  /**
   * Extrae el ID de un campo que puede estar poblado o ser un ObjectId
   */
  private extractId(value: any): string | null {
    if (!value) {
      return null;
    }
    // Si está poblado (tiene _id)
    if (value._id) {
      return value._id.toString();
    }
    // Si tiene id (otra forma de estar poblado)
    if (value.id) {
      return value.id.toString();
    }
    // Si es un ObjectId directamente o cualquier valor que se pueda convertir
    try {
      return value.toString();
    } catch {
      return null;
    }
  }

  async generateFolio(sedeId: string): Promise<string> {
    // Obtener la sede
    const sede = await this.sedesService.findOne(sedeId);

    // Extraer clave de la sede (si está vacío/null, usar fallback "SD")
    const claveSede =
      sede.clave && sede.clave.trim() !== ''
        ? sede.clave.trim().toUpperCase()
        : 'SD';

    // Obtener año actual
    const year = new Date().getFullYear();

    // Calcular rango de fechas para el año actual
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    // Contar órdenes existentes con mismo sedeId y mismo año
    const count = await this.ordenTrabajoModel.countDocuments({
      sedeId: new Types.ObjectId(sedeId),
      fechaCreacion: {
        $gte: startOfYear,
        $lte: endOfYear,
      },
    });

    // Generar número secuencial con padding a 4 dígitos
    const sequential = (count + 1).toString().padStart(4, '0');

    // Formato: OT-{CLAVE_SEDE}-{YYYY}-{NNNN}
    return `OT-${claveSede}-${year}-${sequential}`;
  }

  async createFromCotizacion(
    cotizacionId: string,
    usuarioClienteId: string,
    trabajadores: any[],
  ): Promise<OrdenTrabajo> {
    // Validar que la cotización existe y está en estado 'vigente'
    const cotizacion = await this.cotizacionesService.findOne(cotizacionId);

    if (cotizacion.estado !== 'vigente') {
      throw new BadRequestException(
        `La cotización debe estar en estado 'vigente' para ser aceptada. Estado actual: ${cotizacion.estado}`,
      );
    }

    // Validar que no esté vencida
    if (cotizacion.fechaVencimiento < new Date()) {
      throw new BadRequestException(
        'No se puede aceptar una cotización vencida',
      );
    }

    // Validar que el usuarioClienteId pertenece al clienteId de la cotización
    const usuarioCliente =
      await this.clientesService.findUsuarioClienteById(usuarioClienteId);

    const cotizacionDoc = cotizacion as any;
    const usuarioClienteDoc = usuarioCliente as any;

    // Extraer los IDs correctamente (pueden estar poblados o ser ObjectIds)
    const cotizacionClienteId = this.extractId(
      cotizacionDoc.clienteId || cotizacion.clienteId,
    );
    const usuarioClienteClienteId = this.extractId(
      usuarioClienteDoc.clienteId || usuarioCliente.clienteId,
    );

    if (!cotizacionClienteId || !usuarioClienteClienteId) {
      throw new BadRequestException(
        'No se pudo obtener el clienteId de la cotización o del usuario cliente',
      );
    }

    if (cotizacionClienteId !== usuarioClienteClienteId) {
      throw new BadRequestException(
        'El usuario cliente no pertenece al cliente de la cotización',
      );
    }

    // Verificar que no exista ya una orden de trabajo para esta cotización
    const ordenExistente = await this.ordenTrabajoModel
      .findOne({ cotizacionId: new Types.ObjectId(cotizacionId) })
      .exec();

    if (ordenExistente) {
      throw new BadRequestException(
        'Ya existe una orden de trabajo para esta cotización',
      );
    }

    // Obtener datos de la cotización (usar los IDs ya extraídos)
    const clienteIdStr = cotizacionClienteId;
    const sedeIdStr = this.extractId(cotizacionDoc.sedeId || cotizacion.sedeId);

    if (!sedeIdStr) {
      throw new BadRequestException(
        'No se pudo obtener el sedeId de la cotización',
      );
    }

    // Generar folio
    const folio = await this.generateFolio(sedeIdStr);

    // Convertir trabajadores DTOs a objetos Trabajador
    const trabajadoresData = trabajadores.map((t) => ({
      primerApellido: t.primerApellido,
      segundoApellido: t.segundoApellido,
      nombre: t.nombre,
      fechaNacimiento: new Date(t.fechaNacimiento),
      sexo: t.sexo,
      escolaridad: t.escolaridad,
      puesto: t.puesto,
      fechaIngreso: t.fechaIngreso ? new Date(t.fechaIngreso) : undefined,
      telefono: t.telefono,
      estadoCivil: t.estadoCivil,
      curp: t.curp,
    }));

    // Crear nueva OrdenTrabajo con estado 'pendiente'
    const fechaCreacion = new Date();
    const nuevaOrden = new this.ordenTrabajoModel({
      folio,
      cotizacionId: new Types.ObjectId(cotizacionId),
      clienteId: new Types.ObjectId(clienteIdStr),
      usuarioClienteId: new Types.ObjectId(usuarioClienteId),
      sedeId: new Types.ObjectId(sedeIdStr),
      estado: 'pendiente',
      fechaCreacion,
      fechaEstadoPendiente: fechaCreacion,
      trabajadores: trabajadoresData,
    });

    const ordenGuardada = await nuevaOrden.save();

    // Actualizar la cotización: estado='aceptada', fechaAceptacion=now, ordenTrabajoId=nuevaOT
    // Asegurar que ambos IDs sean ObjectIds válidos
    const cotizacionObjectId = new Types.ObjectId(cotizacionId);

    // Extraer el _id de la orden guardada de forma segura
    const ordenTrabajoIdObjectId =
      ordenGuardada._id instanceof Types.ObjectId
        ? ordenGuardada._id
        : new Types.ObjectId(String(ordenGuardada._id));

    await this.cotizacionModel
      .updateOne(
        { _id: cotizacionObjectId },
        {
          $set: {
            estado: 'aceptada',
            fechaAceptacion: fechaCreacion,
            fechaEstadoAceptada: fechaCreacion,
            ordenTrabajoId: ordenTrabajoIdObjectId,
          },
        },
      )
      .exec();

    return ordenGuardada;
  }

  async findAll(
    filters?: FilterOrdenTrabajoDto,
  ): Promise<PaginatedOrdenesTrabajoResponseDto> {
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

    pipeline.push({
      $lookup: {
        from: 'sedes',
        localField: 'sedeId',
        foreignField: '_id',
        as: 'sede',
      },
    });

    pipeline.push({
      $lookup: {
        from: 'cotizacions',
        localField: 'cotizacionId',
        foreignField: '_id',
        as: 'cotizacion',
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

    pipeline.push({
      $unwind: {
        path: '$cotizacion',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Construir $match para filtros
    const matchConditions: any = {};

    if (filters?.clienteId) {
      matchConditions.clienteId = new Types.ObjectId(filters.clienteId);
    }

    if (filters?.sedeId) {
      matchConditions.sedeId = new Types.ObjectId(filters.sedeId);
    }

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

    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Búsqueda por texto en múltiples campos (después de unwinds)
    if (filters?.search) {
      const searchRegex = { $regex: filters.search, $options: 'i' };

      // Mapeo de texto de estado a valor en BD
      const estadoMap: Record<string, string> = {
        pendiente: 'pendiente',
        'en proceso': 'en_proceso',
        completada: 'completada',
        cancelada: 'cancelada',
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
        { 'cotizacion.folio': searchRegex },
      ];

      // Si la búsqueda coincide con un estado, agregarlo
      if (estadoMatch) {
        orConditions.push({ estado: estadoMatch });
      } else {
        // También buscar por estado con regex (por si escriben "Pendiente" con mayúscula)
        orConditions.push({ estado: searchRegex });
      }

      // Agregar condiciones para evitar documentos donde los campos sean null
      // MongoDB $or con campos null puede devolver resultados inesperados
      const matchCondition: any = {
        $or: orConditions,
      };

      pipeline.push({
        $match: matchCondition,
      });
    }

    // Pipeline para contar total (antes de paginación)
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await this.ordenTrabajoModel.aggregate(countPipeline);
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
        fechaCreacion: 1,
        estado: 1,
        empresa: '$cliente.empresa',
        nombreUsuario: '$usuarioCliente.nombre',
        nombreSede: '$sede.ciudad',
        folioCotizacion: '$cotizacion.folio',
      },
    });

    // Ejecutar agregación
    const results = await this.ordenTrabajoModel.aggregate(pipeline).exec();

    // Formatear resultados
    const data: OrdenTrabajoListItemDto[] = results.map((item) => ({
      id: item._id.toString(),
      folio: item.folio,
      fechaCreacion: item.fechaCreacion,
      estado: item.estado,
      empresa: item.empresa,
      nombreUsuario: item.nombreUsuario,
      nombreSede: item.nombreSede,
      folioCotizacion: item.folioCotizacion,
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
    filters?: {
      estado?: string;
      fechaDesde?: string;
      fechaHasta?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<PaginatedOrdenesTrabajoResponseDto> {
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
        from: 'sedes',
        localField: 'sedeId',
        foreignField: '_id',
        as: 'sede',
      },
    });

    pipeline.push({
      $lookup: {
        from: 'cotizacions',
        localField: 'cotizacionId',
        foreignField: '_id',
        as: 'cotizacion',
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
        path: '$sede',
        preserveNullAndEmptyArrays: true,
      },
    });

    pipeline.push({
      $unwind: {
        path: '$cotizacion',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Construir $match - SIEMPRE filtrar por usuarioClienteId
    const matchConditions: any = {
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

    // Pipeline para contar total (antes de paginación)
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await this.ordenTrabajoModel.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Agregar paginación
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Proyectar campos necesarios para la respuesta
    pipeline.push({
      $project: {
        _id: 1,
        folio: 1,
        fechaCreacion: 1,
        estado: 1,
        empresa: '$cliente.empresa',
        nombreSede: '$sede.ciudad',
        folioCotizacion: '$cotizacion.folio',
      },
    });

    // Ejecutar agregación
    const results = await this.ordenTrabajoModel.aggregate(pipeline).exec();

    // Formatear resultados
    const data: OrdenTrabajoListItemDto[] = results.map((item) => ({
      id: item._id.toString(),
      folio: item.folio,
      fechaCreacion: item.fechaCreacion,
      estado: item.estado,
      empresa: item.empresa,
      nombreSede: item.nombreSede,
      folioCotizacion: item.folioCotizacion,
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

  async findOne(id: string): Promise<OrdenTrabajoResponseDto> {
    const orden = await this.ordenTrabajoModel
      .findById(id)
      .populate('clienteId')
      .populate('usuarioClienteId')
      .populate('sedeId')
      .populate('cotizacionId')
      .exec();

    if (!orden) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${id} no encontrada`,
      );
    }

    return this.mapToResponseDto(orden);
  }

  async findOneByUsuarioCliente(
    id: string,
    usuarioClienteId: string,
  ): Promise<OrdenTrabajoResponseDto> {
    const orden = await this.ordenTrabajoModel
      .findOne({
        _id: id,
        usuarioClienteId: new Types.ObjectId(usuarioClienteId),
      })
      .populate('clienteId')
      .populate('usuarioClienteId')
      .populate('sedeId')
      .populate('cotizacionId')
      .exec();

    if (!orden) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${id} no encontrada o no pertenece a su usuario`,
      );
    }

    return this.mapToResponseDto(orden);
  }

  async update(
    id: string,
    updateDto: UpdateOrdenTrabajoDto,
  ): Promise<OrdenTrabajoResponseDto> {
    const orden = await this.ordenTrabajoModel.findById(id).exec();

    if (!orden) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${id} no encontrada`,
      );
    }

    const updateData: any = {};

    // Validar transiciones de estado válidas
    if (updateDto.estado) {
      const estadosValidos = [
        'pendiente',
        'en_proceso',
        'completada',
        'cancelada',
      ];
      if (!estadosValidos.includes(updateDto.estado)) {
        throw new BadRequestException(`Estado inválido: ${updateDto.estado}`);
      }

      updateData.estado = updateDto.estado;
      const ahora = new Date();

      // Guardar timestamp del cambio de estado
      switch (updateDto.estado) {
        case 'pendiente':
          updateData.fechaEstadoPendiente = ahora;
          break;
        case 'en_proceso':
          updateData.fechaEstadoEnProceso = ahora;
          // Si estado cambia a 'en_proceso', setear fechaInicio si no existe
          if (!orden.fechaInicio) {
            updateData.fechaInicio = ahora;
          }
          break;
        case 'completada':
          updateData.fechaEstadoCompletada = ahora;
          updateData.fechaCompletacion = ahora;
          break;
        case 'cancelada':
          updateData.fechaEstadoCancelada = ahora;
          break;
      }
    }

    // Actualizar observaciones si viene en el DTO
    if (updateDto.observaciones !== undefined) {
      // Asegurar que cada observación tenga un timestamp
      updateData.observaciones = updateDto.observaciones.map((obs) => ({
        texto: obs.texto,
        timestamp: obs.timestamp || new Date(),
      }));
    }

    const ordenActualizada = await this.ordenTrabajoModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('clienteId')
      .populate('usuarioClienteId')
      .populate('sedeId')
      .populate('cotizacionId')
      .exec();

    return this.mapToResponseDto(ordenActualizada);
  }

  private mapToResponseDto(
    orden: OrdenTrabajoDocument,
  ): OrdenTrabajoResponseDto {
    const ordenDoc = orden as any;
    const cliente = ordenDoc.clienteId as any;
    const usuarioCliente = ordenDoc.usuarioClienteId as any;
    const sede = ordenDoc.sedeId as any;
    const cotizacion = ordenDoc.cotizacionId as any;

    // Extraer el ID de la cotización correctamente (puede estar poblado o ser ObjectId)
    const cotizacionIdStr =
      this.extractId(cotizacion) || this.extractId(orden.cotizacionId) || null;

    return {
      id: ordenDoc._id?.toString() || ordenDoc.id?.toString(),
      folio: orden.folio,
      cotizacionId: cotizacionIdStr || '',
      cotizacion:
        cotizacion && typeof cotizacion === 'object' && cotizacion.folio
          ? {
              _id:
                this.extractId(cotizacion._id || cotizacion.id || cotizacion) ||
                '',
              folio: cotizacion.folio,
              items: cotizacion.items
                ? cotizacion.items.map((item: any) => ({
                    servicioId:
                      item.servicioId?._id?.toString() ||
                      item.servicioId?.toString() ||
                      item.servicioId,
                    nombreServicioSnapshot: item.nombreServicioSnapshot,
                    descripcionServicioSnapshot: item.descripcionServicioSnapshot,
                    cantidad: item.cantidad,
                  }))
                : undefined,
            }
          : undefined,
      clienteId: ordenDoc.clienteId?.toString() || orden.clienteId?.toString(),
      cliente: cliente
        ? {
            _id: cliente._id?.toString() || cliente.id?.toString(),
            empresa: cliente.empresa,
            nombreContacto: cliente.nombreContacto,
            correo: cliente.correo,
            rfc: cliente.rfc,
          }
        : undefined,
      usuarioClienteId:
        ordenDoc.usuarioClienteId?.toString() ||
        orden.usuarioClienteId?.toString(),
      usuarioCliente: usuarioCliente
        ? {
            _id:
              usuarioCliente._id?.toString() || usuarioCliente.id?.toString(),
            nombre: usuarioCliente.nombre,
            email: usuarioCliente.email,
            telefono: usuarioCliente.telefono,
          }
        : undefined,
      sedeId: ordenDoc.sedeId?.toString() || orden.sedeId?.toString(),
      sede: sede
        ? {
            _id: sede._id?.toString() || sede.id?.toString(),
            ciudad: sede.ciudad,
            clave: sede.clave,
          }
        : undefined,
      estado: orden.estado,
      fechaCreacion: orden.fechaCreacion,
      fechaInicio: orden.fechaInicio,
      fechaCompletacion: orden.fechaCompletacion,
      fechaEstadoPendiente: orden.fechaEstadoPendiente,
      fechaEstadoEnProceso: orden.fechaEstadoEnProceso,
      fechaEstadoCompletada: orden.fechaEstadoCompletada,
      fechaEstadoCancelada: orden.fechaEstadoCancelada,
      observaciones: orden.observaciones,
      trabajadores: orden.trabajadores || [],
      createdAt: ordenDoc.createdAt || ordenDoc.createdAt,
      updatedAt: ordenDoc.updatedAt || ordenDoc.updatedAt,
    };
  }

  async agregarTrabajador(
    ordenTrabajoId: string,
    usuarioClienteId: string,
    trabajadorDto: CreateTrabajadorDto,
  ): Promise<OrdenTrabajoResponseDto> {
    // Validar que la orden existe y pertenece al usuario
    const orden = await this.findOneByUsuarioCliente(
      ordenTrabajoId,
      usuarioClienteId,
    );

    // Obtener la cotización para validar cantidad máxima
    const cotizacion = await this.cotizacionesService.findOne(
      orden.cotizacionId,
    );
    const cantidadServicios = cotizacion.items.reduce(
      (sum, item) => sum + item.cantidad,
      0,
    );

    // Validar que no exceda la cantidad máxima
    const cantidadActual = orden.trabajadores?.length || 0;
    if (cantidadActual >= cantidadServicios) {
      throw new BadRequestException(
        `No se pueden agregar más trabajadores. Máximo permitido: ${cantidadServicios}`,
      );
    }

    // Convertir DTO a objeto Trabajador
    const nuevoTrabajador = {
      primerApellido: trabajadorDto.primerApellido,
      segundoApellido: trabajadorDto.segundoApellido,
      nombre: trabajadorDto.nombre,
      fechaNacimiento: new Date(trabajadorDto.fechaNacimiento),
      sexo: trabajadorDto.sexo,
      escolaridad: trabajadorDto.escolaridad,
      puesto: trabajadorDto.puesto,
      fechaIngreso: trabajadorDto.fechaIngreso
        ? new Date(trabajadorDto.fechaIngreso)
        : undefined,
      telefono: trabajadorDto.telefono,
      estadoCivil: trabajadorDto.estadoCivil,
      curp: trabajadorDto.curp,
    };

    // Agregar trabajador al array
    const ordenActualizada = await this.ordenTrabajoModel
      .findByIdAndUpdate(
        ordenTrabajoId,
        {
          $push: { trabajadores: nuevoTrabajador },
        },
        { new: true },
      )
      .populate('clienteId')
      .populate('usuarioClienteId')
      .populate('sedeId')
      .populate('cotizacionId')
      .exec();

    if (!ordenActualizada) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${ordenTrabajoId} no encontrada`,
      );
    }

    return this.mapToResponseDto(ordenActualizada);
  }

  async actualizarTrabajador(
    ordenTrabajoId: string,
    usuarioClienteId: string,
    trabajadorIndex: number,
    trabajadorDto: UpdateTrabajadorDto,
  ): Promise<OrdenTrabajoResponseDto> {
    // Validar que la orden existe y pertenece al usuario
    const orden = await this.findOneByUsuarioCliente(
      ordenTrabajoId,
      usuarioClienteId,
    );

    if (!orden.trabajadores || orden.trabajadores.length === 0) {
      throw new BadRequestException('La orden de trabajo no tiene trabajadores');
    }

    if (trabajadorIndex < 0 || trabajadorIndex >= orden.trabajadores.length) {
      throw new BadRequestException('Índice de trabajador inválido');
    }

    // Obtener trabajador actual
    const trabajadorActual = orden.trabajadores[trabajadorIndex];

    // Crear objeto actualizado
    const trabajadorActualizado: any = {
      primerApellido:
        trabajadorDto.primerApellido ?? trabajadorActual.primerApellido,
      segundoApellido:
        trabajadorDto.segundoApellido ?? trabajadorActual.segundoApellido,
      nombre: trabajadorDto.nombre ?? trabajadorActual.nombre,
      fechaNacimiento: trabajadorDto.fechaNacimiento
        ? new Date(trabajadorDto.fechaNacimiento)
        : trabajadorActual.fechaNacimiento,
      sexo: trabajadorDto.sexo ?? trabajadorActual.sexo,
      escolaridad:
        trabajadorDto.escolaridad ?? trabajadorActual.escolaridad,
      puesto: trabajadorDto.puesto ?? trabajadorActual.puesto,
      fechaIngreso: trabajadorDto.fechaIngreso
        ? new Date(trabajadorDto.fechaIngreso)
        : trabajadorActual.fechaIngreso,
      telefono: trabajadorDto.telefono ?? trabajadorActual.telefono,
      estadoCivil:
        trabajadorDto.estadoCivil ?? trabajadorActual.estadoCivil,
      curp: trabajadorDto.curp ?? trabajadorActual.curp,
    };

    // Actualizar trabajador en el array usando $set con notación de índice
    const ordenActualizada = await this.ordenTrabajoModel
      .findByIdAndUpdate(
        ordenTrabajoId,
        {
          $set: {
            [`trabajadores.${trabajadorIndex}`]: trabajadorActualizado,
          },
        },
        { new: true },
      )
      .populate('clienteId')
      .populate('usuarioClienteId')
      .populate('sedeId')
      .populate('cotizacionId')
      .exec();

    if (!ordenActualizada) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${ordenTrabajoId} no encontrada`,
      );
    }

    return this.mapToResponseDto(ordenActualizada);
  }

  async eliminarTrabajador(
    ordenTrabajoId: string,
    usuarioClienteId: string,
    trabajadorIndex: number,
  ): Promise<OrdenTrabajoResponseDto> {
    // Validar que la orden existe y pertenece al usuario
    const orden = await this.findOneByUsuarioCliente(
      ordenTrabajoId,
      usuarioClienteId,
    );

    if (!orden.trabajadores || orden.trabajadores.length === 0) {
      throw new BadRequestException('La orden de trabajo no tiene trabajadores');
    }

    if (trabajadorIndex < 0 || trabajadorIndex >= orden.trabajadores.length) {
      throw new BadRequestException('Índice de trabajador inválido');
    }

    // Obtener la cotización para validar cantidad mínima
    const cotizacion = await this.cotizacionesService.findOne(
      orden.cotizacionId,
    );
    const cantidadServicios = cotizacion.items.reduce(
      (sum, item) => sum + item.cantidad,
      0,
    );

    // Validar que no quede por debajo del mínimo (1 trabajador)
    const cantidadActual = orden.trabajadores.length;
    if (cantidadActual <= 1) {
      throw new BadRequestException(
        'Debe haber al menos un trabajador en la orden de trabajo',
      );
    }

    // Obtener trabajadores actuales y eliminar el índice especificado
    const trabajadoresActuales = [...orden.trabajadores];
    trabajadoresActuales.splice(trabajadorIndex, 1);

    // Actualizar la orden con el array sin el trabajador eliminado
    const ordenActualizada = await this.ordenTrabajoModel
      .findByIdAndUpdate(
        ordenTrabajoId,
        {
          $set: { trabajadores: trabajadoresActuales },
        },
        { new: true },
      )
      .populate('clienteId')
      .populate('usuarioClienteId')
      .populate('sedeId')
      .populate('cotizacionId')
      .exec();

    if (!ordenActualizada) {
      throw new NotFoundException(
        `Orden de trabajo con ID ${ordenTrabajoId} no encontrada`,
      );
    }

    return this.mapToResponseDto(ordenActualizada);
  }
}
