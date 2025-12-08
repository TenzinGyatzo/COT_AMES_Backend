import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Cotizacion,
  CotizacionDocument,
} from '../cotizaciones/schemas/cotizacion.schema';
import { Cliente, ClienteDocument } from '../clientes/schemas/cliente.schema';
import {
  Servicio,
  ServicioDocument,
} from '../servicios/schemas/servicio.schema';
import { FilterMetricsDto } from './dto/filter-metrics.dto';
import { ClientMetricDto } from './dto/client-metric.dto';
import { ServiceMetricDto } from './dto/service-metric.dto';
import { TotalsMetricDto } from './dto/totals-metric.dto';

@Injectable()
export class MetricsService {
  constructor(
    @InjectModel(Cotizacion.name)
    private cotizacionModel: Model<CotizacionDocument>,
    @InjectModel(Cliente.name)
    private clienteModel: Model<ClienteDocument>,
    @InjectModel(Servicio.name)
    private servicioModel: Model<ServicioDocument>,
  ) {}

  async getClientsMetrics(
    filters?: FilterMetricsDto,
  ): Promise<ClientMetricDto[]> {
    const matchConditions: any[] = [];

    if (filters?.sedeId) {
      // Usar $or para comparar tanto ObjectId como string
      // Esto maneja el caso donde sedeId puede estar almacenado como ObjectId o como string
      try {
        const sedeIdObjectId = new Types.ObjectId(filters.sedeId);
        matchConditions.push({
          $or: [{ sedeId: sedeIdObjectId }, { sedeId: filters.sedeId }],
        });
      } catch {
        matchConditions.push({ sedeId: filters.sedeId });
      }
    }

    if (filters?.fechaDesde || filters?.fechaHasta) {
      const fechaCondition: any = {};
      if (filters.fechaDesde) {
        fechaCondition.$gte = new Date(filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        fechaCondition.$lte = new Date(filters.fechaHasta);
      }
      matchConditions.push({ fechaCreacion: fechaCondition });
    }

    const pipeline: any[] = [];

    if (matchConditions.length > 0) {
      if (matchConditions.length === 1) {
        pipeline.push({ $match: matchConditions[0] });
      } else {
        pipeline.push({ $match: { $and: matchConditions } });
      }
    }

    // Agrupar por cliente
    pipeline.push({
      $group: {
        _id: '$clienteId',
        fechaUltimaCotizacion: { $max: '$fechaCreacion' },
        totalCotizaciones: { $sum: 1 },
      },
    });

    // Lookup para obtener datos del cliente
    pipeline.push({
      $lookup: {
        from: 'clientes',
        localField: '_id',
        foreignField: '_id',
        as: 'cliente',
      },
    });

    pipeline.push({
      $unwind: {
        path: '$cliente',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Lookup para contar órdenes de trabajo por cliente con filtro de sede si existe
    const ordenTrabajoLookup: any = {
      from: 'ordentrabajos',
      localField: '_id',
      foreignField: 'clienteId',
      as: 'ordenesTrabajo',
    };

    // Si hay filtro de sede, agregarlo al lookup usando pipeline
    if (filters?.sedeId) {
      try {
        const sedeIdObjectId = new Types.ObjectId(filters.sedeId);
        ordenTrabajoLookup.pipeline = [
          {
            $match: {
              $or: [{ sedeId: sedeIdObjectId }, { sedeId: filters.sedeId }],
            },
          },
        ];
      } catch {
        ordenTrabajoLookup.pipeline = [
          {
            $match: { sedeId: filters.sedeId },
          },
        ];
      }
    }

    // Si hay filtros de fecha, agregarlos al pipeline del lookup
    if (filters?.fechaDesde || filters?.fechaHasta) {
      if (!ordenTrabajoLookup.pipeline) {
        ordenTrabajoLookup.pipeline = [];
      }
      const fechaMatch: any = {};
      if (filters.fechaDesde) {
        fechaMatch.fechaCreacion = { $gte: new Date(filters.fechaDesde) };
      }
      if (filters.fechaHasta) {
        if (fechaMatch.fechaCreacion) {
          fechaMatch.fechaCreacion.$lte = new Date(filters.fechaHasta);
        } else {
          fechaMatch.fechaCreacion = { $lte: new Date(filters.fechaHasta) };
        }
      }
      if (Object.keys(fechaMatch).length > 0) {
        ordenTrabajoLookup.pipeline.push({ $match: fechaMatch });
      }
    }

    pipeline.push({
      $lookup: ordenTrabajoLookup,
    });

    // Proyectar campos necesarios
    pipeline.push({
      $project: {
        clienteId: '$_id',
        empresa: '$cliente.empresa',
        rfc: '$cliente.rfc',
        fechaUltimaCotizacion: 1,
        totalCotizaciones: 1,
        totalOrdenesTrabajo: { $size: '$ordenesTrabajo' },
      },
    });

    // Ordenar por total de cotizaciones descendente
    pipeline.push({
      $sort: { totalCotizaciones: -1 },
    });

    const results = await this.cotizacionModel.aggregate(pipeline).exec();

    return results.map((item) => ({
      clienteId: item.clienteId.toString(),
      empresa: item.empresa,
      rfc: item.rfc,
      fechaUltimaCotizacion: item.fechaUltimaCotizacion,
      totalCotizaciones: item.totalCotizaciones,
      totalOrdenesTrabajo: item.totalOrdenesTrabajo || 0,
    }));
  }

  async getServicesMetrics(
    filters?: FilterMetricsDto,
  ): Promise<ServiceMetricDto[]> {
    const matchConditions: any = {
      estado: 'aceptada', // Solo contar cotizaciones aceptadas (contratadas)
    };

    if (filters?.sedeId) {
      // Asegurar que el sedeId sea un ObjectId válido
      try {
        const sedeIdObjectId = new Types.ObjectId(filters.sedeId);
        // Usar $or para comparar tanto ObjectId como string
        matchConditions.$and = [
          { estado: 'aceptada' },
          {
            $or: [{ sedeId: sedeIdObjectId }, { sedeId: filters.sedeId }],
          },
        ];
      } catch {
        // Si no es un ObjectId válido, usar como string
        matchConditions.sedeId = filters.sedeId;
      }
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

    const pipeline: any[] = [];

    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Desenrollar items
    pipeline.push({
      $unwind: '$items',
    });

    // Agrupar por servicioId y sumar las cantidades contratadas
    pipeline.push({
      $group: {
        _id: '$items.servicioId',
        vecesContratado: { $sum: '$items.cantidad' },
      },
    });

    // Lookup para obtener datos del servicio
    pipeline.push({
      $lookup: {
        from: 'servicios',
        localField: '_id',
        foreignField: '_id',
        as: 'servicio',
      },
    });

    pipeline.push({
      $unwind: {
        path: '$servicio',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Convertir sedeId a ObjectId si es necesario antes del lookup
    pipeline.push({
      $addFields: {
        servicioSedeIdConverted: {
          $cond: {
            if: { $eq: [{ $type: '$servicio.sedeId' }, 'string'] },
            then: { $toObjectId: '$servicio.sedeId' },
            else: '$servicio.sedeId',
          },
        },
      },
    });

    // Lookup para obtener datos de la sede
    pipeline.push({
      $lookup: {
        from: 'sedes',
        localField: 'servicioSedeIdConverted',
        foreignField: '_id',
        as: 'sede',
      },
    });

    pipeline.push({
      $unwind: {
        path: '$sede',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Proyectar campos necesarios
    pipeline.push({
      $project: {
        servicioId: '$_id',
        nombreServicio: '$servicio.nombre',
        sedeId: '$servicio.sedeId',
        claveSede: '$sede.clave',
        precioUnitario: '$servicio.precioUnitario',
        vecesContratado: 1,
      },
    });

    // Ordenar por veces contratado descendente
    pipeline.push({
      $sort: { vecesContratado: -1 },
    });

    const results = await this.cotizacionModel.aggregate(pipeline).exec();

    return results.map((item) => ({
      servicioId: item.servicioId.toString(),
      nombreServicio: item.nombreServicio || 'Servicio eliminado',
      sedeId: item.sedeId?.toString() || '',
      claveSede: item.claveSede || '-',
      precioUnitario: item.precioUnitario || 0,
      vecesContratado: item.vecesContratado,
    }));
  }

  async getTotalsMetrics(filters?: FilterMetricsDto): Promise<TotalsMetricDto> {
    const matchConditions: any = {};

    if (filters?.sedeId) {
      // Asegurar que el sedeId sea un ObjectId válido
      try {
        const sedeIdObjectId = new Types.ObjectId(filters.sedeId);
        // Usar $or para comparar tanto ObjectId como string
        matchConditions.$or = [
          { sedeId: sedeIdObjectId },
          { sedeId: filters.sedeId },
        ];
      } catch {
        // Si no es un ObjectId válido, usar como string
        matchConditions.sedeId = filters.sedeId;
      }
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

    // Fechas para filtros de hoy, mes y año
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const mañana = new Date(hoy);
    mañana.setDate(mañana.getDate() + 1);

    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioAnio = new Date(hoy.getFullYear(), 0, 1);

    // Mayor solicitante - Agrupar por usuarioClienteId para encontrar el usuario con más cotizaciones
    const usuarioClientePipeline: any[] = [];
    if (Object.keys(matchConditions).length > 0) {
      usuarioClientePipeline.push({ $match: matchConditions });
    }
    // Filtrar solo cotizaciones que tengan usuarioClienteId
    usuarioClientePipeline.push({
      $match: { usuarioClienteId: { $exists: true, $ne: null } },
    });
    usuarioClientePipeline.push({
      $group: {
        _id: {
          clienteId: '$clienteId',
          usuarioClienteId: '$usuarioClienteId',
        },
        totalCotizaciones: { $sum: 1 },
      },
    });
    // Lookup del cliente
    usuarioClientePipeline.push({
      $lookup: {
        from: 'clientes',
        localField: '_id.clienteId',
        foreignField: '_id',
        as: 'cliente',
      },
    });
    usuarioClientePipeline.push({
      $unwind: {
        path: '$cliente',
        preserveNullAndEmptyArrays: true,
      },
    });
    // Lookup del usuarioCliente
    usuarioClientePipeline.push({
      $lookup: {
        from: 'usuarioclientes',
        localField: '_id.usuarioClienteId',
        foreignField: '_id',
        as: 'usuarioCliente',
      },
    });
    usuarioClientePipeline.push({
      $unwind: {
        path: '$usuarioCliente',
        preserveNullAndEmptyArrays: true,
      },
    });
    usuarioClientePipeline.push({
      $sort: { totalCotizaciones: -1 },
    });
    usuarioClientePipeline.push({ $limit: 1 });
    usuarioClientePipeline.push({
      $project: {
        clienteId: '$_id.clienteId',
        empresa: '$cliente.empresa',
        rfc: '$cliente.rfc',
        nombreUsuarioCliente: '$usuarioCliente.nombre',
        totalCotizaciones: 1,
      },
    });

    const mayorSolicitanteResult = await this.cotizacionModel
      .aggregate(usuarioClientePipeline)
      .exec();

    // Servicio más contratado (desde cotizaciones aceptadas)
    const servicioPipeline: any[] = [];
    // Construir condiciones de match para servicios (solo cotizaciones aceptadas)
    const servicioMatchConditions: any = {
      estado: 'aceptada',
    };

    // Agregar filtro de sede si existe
    if (matchConditions.sedeId) {
      servicioMatchConditions.sedeId = matchConditions.sedeId;
    } else if (matchConditions.$or) {
      // Si hay $or en matchConditions, combinarlo con estado aceptada
      servicioMatchConditions.$and = [
        { estado: 'aceptada' },
        { $or: matchConditions.$or },
      ];
    }

    // Agregar filtros de fecha si existen
    if (matchConditions.fechaCreacion) {
      servicioMatchConditions.fechaCreacion = matchConditions.fechaCreacion;
    }

    servicioPipeline.push({ $match: servicioMatchConditions });
    servicioPipeline.push({
      $unwind: '$items',
    });
    servicioPipeline.push({
      $group: {
        _id: '$items.servicioId',
        vecesContratado: { $sum: '$items.cantidad' },
      },
    });
    servicioPipeline.push({
      $lookup: {
        from: 'servicios',
        localField: '_id',
        foreignField: '_id',
        as: 'servicio',
      },
    });
    servicioPipeline.push({
      $unwind: {
        path: '$servicio',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Convertir sedeId a ObjectId si es necesario antes del lookup
    servicioPipeline.push({
      $addFields: {
        servicioSedeIdConverted: {
          $cond: {
            if: { $eq: [{ $type: '$servicio.sedeId' }, 'string'] },
            then: { $toObjectId: '$servicio.sedeId' },
            else: '$servicio.sedeId',
          },
        },
      },
    });

    // Lookup para obtener datos de la sede
    servicioPipeline.push({
      $lookup: {
        from: 'sedes',
        localField: 'servicioSedeIdConverted',
        foreignField: '_id',
        as: 'sede',
      },
    });

    servicioPipeline.push({
      $unwind: {
        path: '$sede',
        preserveNullAndEmptyArrays: true,
      },
    });

    servicioPipeline.push({
      $sort: { vecesContratado: -1 },
    });
    servicioPipeline.push({ $limit: 1 });
    servicioPipeline.push({
      $project: {
        servicioId: '$_id',
        nombreServicio: '$servicio.nombre',
        claveSede: '$sede.clave',
        vecesContratado: 1,
      },
    });

    const servicioMasSolicitadoResult = await this.cotizacionModel
      .aggregate(servicioPipeline)
      .exec();

    // Servicio más rentable (por ingresos generados)
    const servicioRentablePipeline: any[] = [];
    servicioRentablePipeline.push({ $match: servicioMatchConditions });
    servicioRentablePipeline.push({
      $unwind: '$items',
    });
    servicioRentablePipeline.push({
      $group: {
        _id: '$items.servicioId',
        ingresosTotales: {
          $sum: {
            $multiply: ['$items.precioUnitarioSnapshot', '$items.cantidad'],
          },
        },
      },
    });
    servicioRentablePipeline.push({
      $lookup: {
        from: 'servicios',
        localField: '_id',
        foreignField: '_id',
        as: 'servicio',
      },
    });
    servicioRentablePipeline.push({
      $unwind: {
        path: '$servicio',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Convertir sedeId a ObjectId si es necesario
    servicioRentablePipeline.push({
      $addFields: {
        servicioSedeIdConverted: {
          $cond: {
            if: { $eq: [{ $type: '$servicio.sedeId' }, 'string'] },
            then: { $toObjectId: '$servicio.sedeId' },
            else: '$servicio.sedeId',
          },
        },
      },
    });

    // Lookup para obtener datos de la sede
    servicioRentablePipeline.push({
      $lookup: {
        from: 'sedes',
        localField: 'servicioSedeIdConverted',
        foreignField: '_id',
        as: 'sede',
      },
    });

    servicioRentablePipeline.push({
      $unwind: {
        path: '$sede',
        preserveNullAndEmptyArrays: true,
      },
    });

    servicioRentablePipeline.push({
      $sort: { ingresosTotales: -1 },
    });
    servicioRentablePipeline.push({ $limit: 1 });
    servicioRentablePipeline.push({
      $project: {
        servicioId: '$_id',
        nombreServicio: '$servicio.nombre',
        claveSede: '$sede.clave',
        ingresosTotales: 1,
      },
    });

    const servicioMasRentableResult = await this.cotizacionModel
      .aggregate(servicioRentablePipeline)
      .exec();

    // Cliente más activo del mes
    const clienteMesPipeline: any[] = [];
    const mesMatchConditions = {
      ...matchConditions,
      fechaCreacion: { $gte: inicioMes },
    };
    if (Object.keys(mesMatchConditions).length > 0) {
      clienteMesPipeline.push({ $match: mesMatchConditions });
    }
    clienteMesPipeline.push({
      $match: { usuarioClienteId: { $exists: true, $ne: null } },
    });
    clienteMesPipeline.push({
      $group: {
        _id: {
          clienteId: '$clienteId',
          usuarioClienteId: '$usuarioClienteId',
        },
        totalCotizaciones: { $sum: 1 },
      },
    });
    clienteMesPipeline.push({
      $lookup: {
        from: 'clientes',
        localField: '_id.clienteId',
        foreignField: '_id',
        as: 'cliente',
      },
    });
    clienteMesPipeline.push({
      $unwind: {
        path: '$cliente',
        preserveNullAndEmptyArrays: true,
      },
    });
    clienteMesPipeline.push({
      $lookup: {
        from: 'usuarioclientes',
        localField: '_id.usuarioClienteId',
        foreignField: '_id',
        as: 'usuarioCliente',
      },
    });
    clienteMesPipeline.push({
      $unwind: {
        path: '$usuarioCliente',
        preserveNullAndEmptyArrays: true,
      },
    });
    clienteMesPipeline.push({
      $sort: { totalCotizaciones: -1 },
    });
    clienteMesPipeline.push({ $limit: 1 });
    clienteMesPipeline.push({
      $project: {
        clienteId: '$_id.clienteId',
        empresa: '$cliente.empresa',
        rfc: '$cliente.rfc',
        nombreUsuarioCliente: '$usuarioCliente.nombre',
        totalCotizaciones: 1,
      },
    });

    const clienteMasActivoMesResult = await this.cotizacionModel
      .aggregate(clienteMesPipeline)
      .exec();

    // Conteos por periodo
    const hoyMatch = {
      ...matchConditions,
      fechaCreacion: { $gte: hoy, $lt: mañana },
    };
    const mesMatch = {
      ...matchConditions,
      fechaCreacion: { $gte: inicioMes },
    };
    const anioMatch = {
      ...matchConditions,
      fechaCreacion: { $gte: inicioAnio },
    };

    // Cotizaciones totales (sin filtro de año, solo con matchConditions si existen)
    const totalMatch =
      Object.keys(matchConditions).length > 0 ? matchConditions : {};

    // Contar cotizaciones aceptadas para tasa de conversión e ingresos
    const aceptadasMatch = {
      ...totalMatch,
      estado: 'aceptada',
    };

    const [
      cotizacionesHoy,
      cotizacionesMes,
      cotizacionesAnio,
      cotizacionesTotales,
      cotizacionesAceptadas,
    ] = await Promise.all([
      this.cotizacionModel.countDocuments(hoyMatch),
      this.cotizacionModel.countDocuments(mesMatch),
      this.cotizacionModel.countDocuments(anioMatch),
      this.cotizacionModel.countDocuments(totalMatch),
      this.cotizacionModel.countDocuments(aceptadasMatch),
    ]);

    // Calcular ingresos totales (suma de totales de cotizaciones aceptadas)
    const ingresosPipeline: any[] = [];
    ingresosPipeline.push({ $match: aceptadasMatch });
    ingresosPipeline.push({
      $group: {
        _id: null,
        ingresosTotales: { $sum: '$total' },
      },
    });

    const ingresosResult = await this.cotizacionModel
      .aggregate(ingresosPipeline)
      .exec();
    const ingresosTotales =
      ingresosResult.length > 0 ? ingresosResult[0].ingresosTotales : 0;

    // Calcular tasa de conversión
    const tasaConversion =
      cotizacionesTotales > 0 ? cotizacionesAceptadas / cotizacionesTotales : 0;

    const mayorSolicitante =
      mayorSolicitanteResult.length > 0
        ? {
            clienteId: mayorSolicitanteResult[0].clienteId.toString(),
            empresa: mayorSolicitanteResult[0].empresa,
            rfc: mayorSolicitanteResult[0].rfc,
            nombreUsuarioCliente:
              mayorSolicitanteResult[0].nombreUsuarioCliente,
            totalCotizaciones: mayorSolicitanteResult[0].totalCotizaciones,
          }
        : undefined;

    const servicioMasSolicitado =
      servicioMasSolicitadoResult.length > 0
        ? {
            servicioId: servicioMasSolicitadoResult[0].servicioId.toString(),
            nombreServicio:
              servicioMasSolicitadoResult[0].nombreServicio ||
              'Servicio eliminado',
            claveSede: servicioMasSolicitadoResult[0].claveSede || '-',
            vecesSolicitado: servicioMasSolicitadoResult[0].vecesContratado,
          }
        : undefined;

    const servicioMasRentable =
      servicioMasRentableResult.length > 0
        ? {
            servicioId: servicioMasRentableResult[0].servicioId.toString(),
            nombreServicio:
              servicioMasRentableResult[0].nombreServicio ||
              'Servicio eliminado',
            claveSede: servicioMasRentableResult[0].claveSede || '-',
            ingresosTotales: servicioMasRentableResult[0].ingresosTotales || 0,
          }
        : undefined;

    const clienteMasActivoMes =
      clienteMasActivoMesResult.length > 0
        ? {
            clienteId: clienteMasActivoMesResult[0].clienteId.toString(),
            empresa: clienteMasActivoMesResult[0].empresa,
            rfc: clienteMasActivoMesResult[0].rfc,
            nombreUsuarioCliente:
              clienteMasActivoMesResult[0].nombreUsuarioCliente,
            totalCotizaciones: clienteMasActivoMesResult[0].totalCotizaciones,
          }
        : undefined;

    return {
      mayorSolicitante,
      clienteMasActivoMes,
      servicioMasSolicitado,
      servicioMasRentable,
      cotizacionesHoy,
      cotizacionesMes,
      cotizacionesAnio,
      cotizacionesTotales,
      tasaConversion,
      ingresosTotales,
    };
  }
}
