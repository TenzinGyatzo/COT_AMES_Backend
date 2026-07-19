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
import { PlantillasService } from './plantillas.service';
import { CreatePlantillaDto } from './dto/create-plantilla.dto';
import { UpdatePlantillaDto } from './dto/update-plantilla.dto';
import { FilterPlantillaDto } from './dto/filter-plantilla.dto';
import { PaginatedPlantillasResponseDto } from './dto/paginated-plantillas-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AMES_ROLES } from '../auth/enums/roles.enum';
import { Roles as RolesDecorator } from '../auth/decorators/roles.decorator';
import { TenantContextGuard } from '../tenants/tenant-context.guard';
import { TenantContextInterceptor } from '../tenants/tenant-context.interceptor';

@ApiTags('plantillas')
@Controller('plantillas')
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
export class PlantillasController {
  constructor(private readonly plantillasService: PlantillasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva plantilla' })
  @ApiResponse({ status: 201, description: 'Plantilla creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@Body() dto: CreatePlantillaDto) {
    return this.plantillasService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar plantillas con búsqueda y paginación',
  })
  @ApiQuery({ name: 'nombre', required: false, type: String })
  @ApiQuery({ name: 'activo', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de plantillas',
    type: PaginatedPlantillasResponseDto,
  })
  findAll(
    @Query() filters?: FilterPlantillaDto,
  ): Promise<PaginatedPlantillasResponseDto> {
    return this.plantillasService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una plantilla por ID' })
  @ApiParam({ name: 'id', description: 'ID de la plantilla' })
  @ApiResponse({ status: 200, description: 'Plantilla encontrada' })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
  findOne(@Param('id') id: string) {
    return this.plantillasService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una plantilla' })
  @ApiParam({ name: 'id', description: 'ID de la plantilla' })
  update(@Param('id') id: string, @Body() dto: UpdatePlantillaDto) {
    return this.plantillasService.update(id, dto);
  }

  @Patch(':id/toggle-activo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar o desactivar una plantilla' })
  @ApiParam({ name: 'id', description: 'ID de la plantilla' })
  toggleActivo(@Param('id') id: string) {
    return this.plantillasService.toggleActivo(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar una plantilla (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID de la plantilla' })
  @ApiResponse({ status: 200, description: 'Plantilla desactivada' })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
  remove(@Param('id') id: string) {
    return this.plantillasService.remove(id);
  }
}
