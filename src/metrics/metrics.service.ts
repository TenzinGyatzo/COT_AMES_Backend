import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Cotizacion,
  CotizacionDocument,
} from '../cotizaciones/schemas/cotizacion.schema';
import { FilterMetricsDto } from './dto/filter-metrics.dto';
import { ClientMetricDto } from './dto/client-metric.dto';
import { ServiceMetricDto } from './dto/service-metric.dto';
import { TotalsMetricDto } from './dto/totals-metric.dto';
import { TenantContextService } from '../tenants/tenant-context.service';

@Injectable()
export class MetricsService {
  constructor(
    @InjectModel(Cotizacion.name)
    private cotizacionModel: Model<CotizacionDocument>,
    private tenantContext: TenantContextService,
  ) {}

  private async buildMatch(filters?: FilterMetricsDto): Promise<any> {
    const tenantId = this.tenantContext.getTenantId();
    const match: any = { tenantId };
    if (filters?.fechaDesde || filters?.fechaHasta) {
      match.fechaCreacion = {};
      if (filters.fechaDesde) {
        match.fechaCreacion.$gte = new Date(filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        match.fechaCreacion.$lte = new Date(filters.fechaHasta);
      }
    }
    return match;
  }

  /**
   * Merge period bounds with user fechaCreacion filter by intersection:
   * $gte/$gt → later bound; $lte/$lt → earlier bound (no overwrite).
   */
  private withMatch(base: any, extra: any = {}): any {
    const result: any = { ...base };
    for (const [key, value] of Object.entries(extra)) {
      if (
        key === 'fechaCreacion' &&
        result.fechaCreacion &&
        typeof value === 'object' &&
        value !== null
      ) {
        const merged: Record<string, Date> = { ...result.fechaCreacion };
        const extraFc = value as Record<string, Date>;
        for (const [op, date] of Object.entries(extraFc)) {
          if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            merged[op] = date;
            continue;
          }
          const existing = merged[op];
          if (
            (op === '$gte' || op === '$gt') &&
            existing instanceof Date &&
            !Number.isNaN(existing.getTime())
          ) {
            merged[op] = new Date(Math.max(existing.getTime(), date.getTime()));
          } else if (
            (op === '$lte' || op === '$lt') &&
            existing instanceof Date &&
            !Number.isNaN(existing.getTime())
          ) {
            merged[op] = new Date(Math.min(existing.getTime(), date.getTime()));
          } else {
            merged[op] = date;
          }
        }
        result.fechaCreacion = merged;
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /** $lookup clientes restringido al tenant en contexto (AD-1). */
  private clienteLookupStage(tenantId: unknown) {
    return {
      $lookup: {
        from: 'clientes',
        let: { clienteId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$_id', '$$clienteId'] },
                  { $eq: ['$tenantId', tenantId] },
                ],
              },
            },
          },
        ],
        as: 'cliente',
      },
    };
  }

  async getClientsMetrics(
    filters?: FilterMetricsDto,
  ): Promise<ClientMetricDto[]> {
    const match = await this.buildMatch(filters);
    const tenantId = match.tenantId;
    const pipeline: any[] = [];
    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    pipeline.push({
      $match: { clienteId: { $exists: true, $ne: null } },
    });
    pipeline.push({
      $group: {
        _id: '$clienteId',
        fechaUltimaCotizacion: { $max: '$fechaCreacion' },
        totalCotizaciones: { $sum: 1 },
      },
    });
    pipeline.push(this.clienteLookupStage(tenantId));
    pipeline.push({
      $unwind: { path: '$cliente', preserveNullAndEmptyArrays: true },
    });
    pipeline.push({
      $project: {
        clienteId: { $toString: '$_id' },
        empresa: '$cliente.empresa',
        rfc: { $ifNull: ['$cliente.rfc', ''] },
        fechaUltimaCotizacion: 1,
        totalCotizaciones: 1,
      },
    });
    pipeline.push({ $sort: { totalCotizaciones: -1 } });

    const results = await this.cotizacionModel.aggregate(pipeline).exec();
    return results.map((item) => ({
      clienteId: item.clienteId || '',
      empresa: item.empresa,
      rfc: item.rfc || '',
      fechaUltimaCotizacion: item.fechaUltimaCotizacion,
      totalCotizaciones: item.totalCotizaciones || 0,
    }));
  }

  async getServicesMetrics(
    filters?: FilterMetricsDto,
  ): Promise<ServiceMetricDto[]> {
    const match = await this.buildMatch(filters);
    match.estado = 'aceptada';
    const pipeline: any[] = [
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.servicioId',
          vecesContratado: { $sum: '$items.cantidad' },
          nombreServicio: {
            $first: '$items.nombreServicioSnapshot',
          },
          precioUnitario: {
            $first: '$items.precioUnitarioSnapshot',
          },
        },
      },
      {
        $lookup: {
          from: 'servicios',
          localField: '_id',
          foreignField: '_id',
          as: 'servicio',
        },
      },
      {
        $unwind: { path: '$servicio', preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          servicioId: { $toString: '$_id' },
          nombreServicio: {
            $ifNull: ['$nombreServicio', '$servicio.nombre'],
          },
          precioUnitario: {
            $ifNull: ['$precioUnitario', '$servicio.precioUnitario'],
          },
          vecesContratado: 1,
        },
      },
      { $sort: { vecesContratado: -1 } },
    ];

    const results = await this.cotizacionModel.aggregate(pipeline).exec();
    return results.map((item) => ({
      servicioId: item.servicioId || '',
      nombreServicio: item.nombreServicio || 'Servicio eliminado',
      precioUnitario: item.precioUnitario || 0,
      vecesContratado: item.vecesContratado || 0,
    }));
  }

  async getTotalsMetrics(filters?: FilterMetricsDto): Promise<TotalsMetricDto> {
    const match = await this.buildMatch(filters);
    const tenantId = match.tenantId;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const withMatch = (extra: any = {}) => this.withMatch(match, extra);
    const clienteLookup = this.clienteLookupStage(tenantId);

    const [
      mayorSolicitanteResult,
      clienteMasActivoMesResult,
      servicioMasSolicitadoResult,
      servicioMasRentableResult,
      cotizacionesHoy,
      cotizacionesMes,
      cotizacionesAnio,
      cotizacionesTotales,
      aceptadas,
      rechazadas,
      ingresos,
    ] = await Promise.all([
      this.cotizacionModel
        .aggregate([
          { $match: withMatch({ clienteId: { $exists: true, $ne: null } }) },
          {
            $group: {
              _id: '$clienteId',
              totalCotizaciones: { $sum: 1 },
            },
          },
          { $sort: { totalCotizaciones: -1 } },
          { $limit: 1 },
          clienteLookup,
          {
            $unwind: { path: '$cliente', preserveNullAndEmptyArrays: true },
          },
        ])
        .exec(),
      this.cotizacionModel
        .aggregate([
          {
            $match: withMatch({
              clienteId: { $exists: true, $ne: null },
              fechaCreacion: { $gte: startOfMonth },
            }),
          },
          {
            $group: {
              _id: '$clienteId',
              totalCotizaciones: { $sum: 1 },
            },
          },
          { $sort: { totalCotizaciones: -1 } },
          { $limit: 1 },
          clienteLookup,
          {
            $unwind: { path: '$cliente', preserveNullAndEmptyArrays: true },
          },
        ])
        .exec(),
      this.cotizacionModel
        .aggregate([
          { $match: withMatch({ estado: 'aceptada' }) },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.servicioId',
              vecesSolicitado: { $sum: '$items.cantidad' },
              nombreServicio: { $first: '$items.nombreServicioSnapshot' },
            },
          },
          { $sort: { vecesSolicitado: -1 } },
          { $limit: 1 },
        ])
        .exec(),
      this.cotizacionModel
        .aggregate([
          { $match: withMatch({ estado: 'aceptada' }) },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.servicioId',
              ingresosTotales: {
                $sum: {
                  $ifNull: [
                    '$items.subtotal',
                    {
                      $multiply: [
                        '$items.precioUnitarioSnapshot',
                        '$items.cantidad',
                      ],
                    },
                  ],
                },
              },
              nombreServicio: { $first: '$items.nombreServicioSnapshot' },
            },
          },
          { $sort: { ingresosTotales: -1 } },
          { $limit: 1 },
        ])
        .exec(),
      this.cotizacionModel.countDocuments(
        withMatch({
          fechaCreacion: { $gte: startOfDay, $lt: endOfDay },
        }),
      ),
      this.cotizacionModel.countDocuments(
        withMatch({ fechaCreacion: { $gte: startOfMonth } }),
      ),
      this.cotizacionModel.countDocuments(
        withMatch({ fechaCreacion: { $gte: startOfYear } }),
      ),
      this.cotizacionModel.countDocuments(match),
      this.cotizacionModel.countDocuments(withMatch({ estado: 'aceptada' })),
      this.cotizacionModel.countDocuments(withMatch({ estado: 'rechazada' })),
      this.cotizacionModel
        .aggregate([
          { $match: withMatch({ estado: 'aceptada' }) },
          { $group: { _id: null, total: { $sum: '$total' } } },
        ])
        .exec(),
    ]);

    const emitidas = cotizacionesTotales;
    const result: TotalsMetricDto = {
      cotizacionesHoy,
      cotizacionesMes,
      cotizacionesAnio,
      cotizacionesTotales,
      cotizacionesEmitidas: emitidas,
      cotizacionesAceptadas: aceptadas,
      cotizacionesRechazadas: rechazadas,
      tasaConversion: emitidas > 0 ? aceptadas / emitidas : 0,
      ingresosTotales: ingresos[0]?.total || 0,
    };

    if (mayorSolicitanteResult[0]) {
      const r = mayorSolicitanteResult[0];
      result.mayorSolicitante = {
        clienteId: r._id?.toString() || '',
        empresa: r.cliente?.empresa,
        rfc: r.cliente?.rfc || '',
        totalCotizaciones: r.totalCotizaciones,
      };
    }

    if (clienteMasActivoMesResult[0]) {
      const r = clienteMasActivoMesResult[0];
      result.clienteMasActivoMes = {
        clienteId: r._id?.toString() || '',
        empresa: r.cliente?.empresa,
        rfc: r.cliente?.rfc || '',
        totalCotizaciones: r.totalCotizaciones,
      };
    }

    if (servicioMasSolicitadoResult[0]) {
      const r = servicioMasSolicitadoResult[0];
      result.servicioMasSolicitado = {
        servicioId: r._id?.toString() || '',
        nombreServicio: r.nombreServicio || 'Servicio eliminado',
        vecesSolicitado: r.vecesSolicitado || 0,
      };
    }

    if (servicioMasRentableResult[0]) {
      const r = servicioMasRentableResult[0];
      result.servicioMasRentable = {
        servicioId: r._id?.toString() || '',
        nombreServicio: r.nombreServicio || 'Servicio eliminado',
        ingresosTotales: r.ingresosTotales || 0,
      };
    }

    return result;
  }
}
