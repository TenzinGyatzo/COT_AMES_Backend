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
import { CategoriasServicioService } from './categorias-servicio.service';
import { CreateCategoriaServicioDto } from './dto/create-categoria-servicio.dto';
import { UpdateCategoriaServicioDto } from './dto/update-categoria-servicio.dto';
import { FilterCategoriaServicioDto } from './dto/filter-categoria-servicio.dto';
import { PaginatedCategoriasServicioResponseDto } from './dto/paginated-categorias-servicio-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AMES_ROLES } from '../auth/enums/roles.enum';
import { Roles as RolesDecorator } from '../auth/decorators/roles.decorator';
import { TenantContextGuard } from '../tenants/tenant-context.guard';
import { TenantContextInterceptor } from '../tenants/tenant-context.interceptor';

@ApiTags('servicios-categorias')
@Controller('servicios/categorias')
@UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard)
@UseInterceptors(TenantContextInterceptor)
@RolesDecorator(...AMES_ROLES)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Tenant-Id',
  required: false,
  description:
    'Obligatorio para admin_sistema (400 si ausente; 403 si inválido/inactivo). Operativo y admin_tenant: no enviar — se ignora; tenant del JWT.',
})
export class CategoriasServicioController {
  constructor(
    private readonly categoriasServicioService: CategoriasServicioService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear una categoría de catálogo (Story 5.1)' })
  @ApiResponse({ status: 201, description: 'Categoría creada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Código duplicado en el tenant' })
  create(@Body() dto: CreateCategoriaServicioDto) {
    return this.categoriasServicioService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar categorías del tenant (default: activas)',
  })
  @ApiQuery({ name: 'activo', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de categorías (vacía si el tenant no tiene)',
    type: PaginatedCategoriasServicioResponseDto,
  })
  findAll(
    @Query() filters?: FilterCategoriaServicioDto,
  ): Promise<PaginatedCategoriasServicioResponseDto> {
    return this.categoriasServicioService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una categoría por ID' })
  @ApiParam({ name: 'id', description: 'ID de la categoría' })
  @ApiResponse({ status: 200, description: 'Categoría encontrada' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  findOne(@Param('id') id: string) {
    return this.categoriasServicioService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una categoría' })
  @ApiParam({ name: 'id', description: 'ID de la categoría' })
  @ApiResponse({ status: 200, description: 'Categoría actualizada' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({ status: 409, description: 'Código duplicado en el tenant' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoriaServicioDto,
  ) {
    return this.categoriasServicioService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Baja lógica de categoría (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID de la categoría' })
  @ApiResponse({ status: 200, description: 'Categoría desactivada' })
  @ApiResponse({
    status: 409,
    description: 'Hay ítems activos asociados a la categoría',
  })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  remove(@Param('id') id: string) {
    return this.categoriasServicioService.remove(id);
  }
}
