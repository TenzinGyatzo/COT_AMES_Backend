import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { FilterMetricsDto } from './dto/filter-metrics.dto';
import { ClientMetricDto } from './dto/client-metric.dto';
import { ServiceMetricDto } from './dto/service-metric.dto';
import { TotalsMetricDto } from './dto/totals-metric.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AMES_ROLES } from '../auth/enums/roles.enum';
import { Roles as RolesDecorator } from '../auth/decorators/roles.decorator';
import { TenantContextGuard } from '../tenants/tenant-context.guard';
import { TenantContextInterceptor } from '../tenants/tenant-context.interceptor';

@ApiTags('metrics')
@Controller('metrics')
@UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard)
@UseInterceptors(TenantContextInterceptor)
@RolesDecorator(...AMES_ROLES)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Tenant-Id',
  required: false,
  description:
    'Obligatorio para admin_sistema (400 si ausente; 403 si inválido/inactivo). Operativo: no enviar — se ignora; tenant del JWT.',
})
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('clients')
  @ApiOperation({
    summary: 'Obtener métricas de clientes',
    description:
      'Endpoint administrativo de solo lectura que devuelve estadísticas de clientes incluyendo fecha de última cotización y total de cotizaciones. Permite filtrar por rango de fechas.',
  })
  @ApiQuery({
    name: 'fechaDesde',
    required: false,
    type: String,
    description: 'Fecha desde (ISO string)',
  })
  @ApiQuery({
    name: 'fechaHasta',
    required: false,
    type: String,
    description: 'Fecha hasta (ISO string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas de clientes obtenidas exitosamente',
    type: [ClientMetricDto],
  })
  getClientsMetrics(
    @Query() filters?: FilterMetricsDto,
  ): Promise<ClientMetricDto[]> {
    return this.metricsService.getClientsMetrics(filters);
  }

  @Get('services')
  @ApiOperation({
    summary: 'Obtener métricas de servicios',
    description:
      'Endpoint administrativo de solo lectura que devuelve estadísticas de servicios incluyendo cuántas veces se ha solicitado cada servicio. Permite filtrar por rango de fechas.',
  })
  @ApiQuery({
    name: 'fechaDesde',
    required: false,
    type: String,
    description: 'Fecha desde (ISO string)',
  })
  @ApiQuery({
    name: 'fechaHasta',
    required: false,
    type: String,
    description: 'Fecha hasta (ISO string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas de servicios obtenidas exitosamente',
    type: [ServiceMetricDto],
  })
  getServicesMetrics(
    @Query() filters?: FilterMetricsDto,
  ): Promise<ServiceMetricDto[]> {
    return this.metricsService.getServicesMetrics(filters);
  }

  @Get('totals')
  @ApiOperation({
    summary: 'Obtener métricas totales agregadas',
    description:
      'Endpoint administrativo de solo lectura que devuelve métricas agregadas incluyendo mayor solicitante, servicio más solicitado y conteos de cotizaciones por periodo (hoy, mes, año). Permite filtrar por rango de fechas.',
  })
  @ApiQuery({
    name: 'fechaDesde',
    required: false,
    type: String,
    description: 'Fecha desde (ISO string)',
  })
  @ApiQuery({
    name: 'fechaHasta',
    required: false,
    type: String,
    description: 'Fecha hasta (ISO string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas totales obtenidas exitosamente',
    type: TotalsMetricDto,
  })
  getTotalsMetrics(
    @Query() filters?: FilterMetricsDto,
  ): Promise<TotalsMetricDto> {
    return this.metricsService.getTotalsMetrics(filters);
  }
}
