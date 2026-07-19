import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
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
import { ContactosService } from './contactos.service';
import { CreateContactoDto } from './dto/create-contacto.dto';
import { UpdateContactoDto } from './dto/update-contacto.dto';
import { FilterContactoDto } from './dto/filter-contacto.dto';
import { PaginatedContactosResponseDto } from './dto/paginated-contactos-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AMES_ROLES } from '../auth/enums/roles.enum';
import { Roles as RolesDecorator } from '../auth/decorators/roles.decorator';
import { TenantContextGuard } from '../tenants/tenant-context.guard';
import { TenantContextInterceptor } from '../tenants/tenant-context.interceptor';

@ApiTags('contactos')
@Controller('clientes/:clienteId/contactos')
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
export class ContactosController {
  constructor(private readonly contactosService: ContactosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear contacto de un cliente (Story 3.3)' })
  @ApiParam({ name: 'clienteId', description: 'ID del cliente' })
  @ApiResponse({ status: 201, description: 'Contacto creado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o cliente inactivo' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  create(
    @Param('clienteId') clienteId: string,
    @Body() dto: CreateContactoDto,
  ) {
    return this.contactosService.create(clienteId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar contactos del cliente (Story 3.3)',
    description:
      'Default: solo activos. activo=false para inactivos. Búsqueda por nombre.',
  })
  @ApiParam({ name: 'clienteId', description: 'ID del cliente' })
  @ApiQuery({ name: 'nombre', required: false, type: String })
  @ApiQuery({ name: 'activo', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: PaginatedContactosResponseDto })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  findAll(
    @Param('clienteId') clienteId: string,
    @Query() filters?: FilterContactoDto,
  ) {
    return this.contactosService.findAll(clienteId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un contacto' })
  @ApiParam({ name: 'clienteId', description: 'ID del cliente' })
  @ApiParam({ name: 'id', description: 'ID del contacto' })
  @ApiResponse({ status: 200, description: 'Contacto encontrado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  findOne(
    @Param('clienteId') clienteId: string,
    @Param('id') id: string,
  ) {
    return this.contactosService.findOne(clienteId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un contacto' })
  @ApiParam({ name: 'clienteId', description: 'ID del cliente' })
  @ApiParam({ name: 'id', description: 'ID del contacto' })
  @ApiResponse({ status: 200, description: 'Contacto actualizado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  update(
    @Param('clienteId') clienteId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContactoDto,
  ) {
    return this.contactosService.update(clienteId, id, dto);
  }

  @Patch(':id/toggle-activo')
  @ApiOperation({ summary: 'Activar o desactivar un contacto' })
  @ApiParam({ name: 'clienteId', description: 'ID del cliente' })
  @ApiParam({ name: 'id', description: 'ID del contacto' })
  @ApiResponse({ status: 200, description: 'Estado invertido' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  toggleActivo(
    @Param('clienteId') clienteId: string,
    @Param('id') id: string,
  ) {
    return this.contactosService.toggleActivo(clienteId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar contacto (soft delete)' })
  @ApiParam({ name: 'clienteId', description: 'ID del cliente' })
  @ApiParam({ name: 'id', description: 'ID del contacto' })
  @ApiResponse({ status: 200, description: 'Contacto desactivado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  remove(
    @Param('clienteId') clienteId: string,
    @Param('id') id: string,
  ) {
    return this.contactosService.remove(clienteId, id);
  }
}
