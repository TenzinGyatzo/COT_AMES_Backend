import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { ServiciosService } from './servicios.service';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { CreateServicioMultiDto } from './dto/create-servicio-multi.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';
import { FilterServicioDto } from './dto/filter-servicio.dto';
import { PaginatedServiciosResponseDto } from './dto/paginated-servicios-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AMES_ROLES } from '../auth/enums/roles.enum';
import { Roles as RolesDecorator } from '../auth/decorators/roles.decorator';
import { TenantContextGuard } from '../tenants/tenant-context.guard';
import { TenantContextInterceptor } from '../tenants/tenant-context.interceptor';
import { CATEGORIA_SERVICIO_VALUES } from './enums/categoria-servicio.enum';

@ApiTags('servicios')
@Controller('servicios')
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
export class ServiciosController {
  constructor(private readonly serviciosService: ServiciosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo servicio' })
  @ApiResponse({ status: 201, description: 'Servicio creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@Body() createServicioDto: CreateServicioDto) {
    return this.serviciosService.create(createServicioDto);
  }

  /**
   * Story 4.4 — alta multi-tenant create-only (admin_sistema).
   * `tenantIds` en body = destinos de creación (excepción acotada AD-2).
   */
  @Post('multi-tenant')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary:
      'Crear servicio en uno o ambos tenants (solo admin_sistema, solo creación)',
  })
  @ApiResponse({
    status: 201,
    description: 'Servicios creados (uno por tenant destino)',
  })
  @ApiResponse({ status: 400, description: 'Datos o tenants inválidos' })
  @ApiResponse({ status: 403, description: 'Solo administrador de sistema' })
  createMulti(@Body() dto: CreateServicioMultiDto) {
    return this.serviciosService.createForTenants(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar servicios con búsqueda, categoría y paginación',
  })
  @ApiQuery({ name: 'nombre', required: false, type: String })
  @ApiQuery({
    name: 'categoria',
    required: false,
    enum: CATEGORIA_SERVICIO_VALUES,
  })
  @ApiQuery({ name: 'activo', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de servicios',
    type: PaginatedServiciosResponseDto,
  })
  findAll(
    @Query() filters?: FilterServicioDto,
  ): Promise<PaginatedServiciosResponseDto> {
    return this.serviciosService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un servicio por ID' })
  @ApiParam({ name: 'id', description: 'ID del servicio' })
  @ApiResponse({ status: 200, description: 'Servicio encontrado' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  findOne(@Param('id') id: string) {
    return this.serviciosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un servicio' })
  @ApiParam({ name: 'id', description: 'ID del servicio' })
  update(
    @Param('id') id: string,
    @Body() updateServicioDto: UpdateServicioDto,
  ) {
    return this.serviciosService.update(id, updateServicioDto);
  }

  @Patch(':id/toggle-activo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar o desactivar un servicio' })
  @ApiParam({ name: 'id', description: 'ID del servicio' })
  toggleActivo(@Param('id') id: string) {
    return this.serviciosService.toggleActivo(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar un servicio (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del servicio' })
  @ApiResponse({ status: 200, description: 'Servicio desactivado' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  remove(@Param('id') id: string) {
    return this.serviciosService.remove(id);
  }
}
