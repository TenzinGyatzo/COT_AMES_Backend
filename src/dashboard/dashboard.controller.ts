import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { EntityTotalsDto } from './dto/entity-totals.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AMES_ROLES } from '../auth/enums/roles.enum';
import { Roles as RolesDecorator } from '../auth/decorators/roles.decorator';
import { TenantContextGuard } from '../tenants/tenant-context.guard';
import { TenantContextInterceptor } from '../tenants/tenant-context.interceptor';

@ApiTags('dashboard')
@Controller('dashboard')
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
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('entity-totals')
  @ApiOperation({
    summary: 'Totales CRM del tenant (Story 7.3)',
    description:
      'Clientes, Contactos, Usuarios operativos y Servicios activos del tenant en contexto. Accesible a operativo y admin_sistema.',
  })
  @ApiResponse({ status: 200, type: EntityTotalsDto })
  getEntityTotals(): Promise<EntityTotalsDto> {
    return this.dashboardService.getEntityTotals();
  }
}
