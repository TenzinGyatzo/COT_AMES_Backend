import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/enums/roles.enum';
import { Roles as RolesDecorator } from '../auth/decorators/roles.decorator';
import { OnboardTenantDto } from './dto/onboard-tenant.dto';
import { UpdateTenantActivoDto } from './dto/update-tenant-activo.dto';

@ApiTags('tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@RolesDecorator(Roles.ADMIN_SISTEMA)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Inventario de tenants de plataforma (activos e inactivos — AD-16 / AD-14)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tenants (_id, nombre, clave, activo, createdAt?)',
  })
  @ApiResponse({ status: 403, description: 'Rol no autorizado' })
  findAll() {
    return this.tenantsService.findAllForPlatform();
  }

  @Patch(':id/activo')
  @ApiOperation({
    summary:
      'Suspender o reactivar tenant (Tenant.activo — AD-14 / AD-16). Idempotente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant actualizado (_id, nombre, clave, activo, createdAt?)',
  })
  @ApiResponse({ status: 403, description: 'Rol no autorizado' })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  setActivo(@Param('id') id: string, @Body() dto: UpdateTenantActivoDto) {
    return this.tenantsService.setActivo(id, dto.activo);
  }

  @Post('onboard')
  @ApiOperation({
    summary:
      'Onboarding atómico: tenant + config + seeds + primer admin_tenant (AD-13)',
  })
  @ApiResponse({ status: 201, description: 'Tenant provisionado' })
  @ApiResponse({ status: 403, description: 'Rol no autorizado' })
  @ApiResponse({ status: 409, description: 'Clave o email en conflicto' })
  onboard(@Body() dto: OnboardTenantDto) {
    return this.tenantsService.onboard(dto);
  }
}
