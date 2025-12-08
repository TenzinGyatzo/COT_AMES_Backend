import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrdenesTrabajoService } from './ordenes-trabajo.service';
import { UpdateOrdenTrabajoDto } from './dto/update-orden-trabajo.dto';
import { FilterOrdenTrabajoDto } from './dto/filter-orden-trabajo.dto';
import { PaginatedOrdenesTrabajoResponseDto } from './dto/paginated-ordenes-trabajo-response.dto';
import { OrdenTrabajoResponseDto } from './dto/orden-trabajo-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/enums/roles.enum';
import { Roles as RolesDecorator } from '../auth/decorators/roles.decorator';

@ApiTags('ordenes-trabajo')
@Controller('ordenes-trabajo')
@UseGuards(JwtAuthGuard, RolesGuard)
@RolesDecorator(Roles.ADMIN)
@ApiBearerAuth()
export class OrdenesTrabajoController {
  constructor(private readonly ordenesTrabajoService: OrdenesTrabajoService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar órdenes de trabajo con filtros opcionales y paginación',
    description:
      'Endpoint administrativo para listar órdenes de trabajo con filtros avanzados y paginación. Permite filtrar por cliente, sede, estado y fechas.',
  })
  @ApiQuery({
    name: 'clienteId',
    required: false,
    type: String,
    description: 'Filtrar por ID de cliente',
  })
  @ApiQuery({
    name: 'sedeId',
    required: false,
    type: String,
    description: 'Filtrar por ID de sede',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['pendiente', 'en_proceso', 'completada', 'cancelada'],
    description: 'Filtrar por estado de la orden',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Búsqueda por folio, empresa, estado, sede, contacto o folio de cotización',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Número de elementos por página (default: 10)',
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
    description: 'Lista paginada de órdenes de trabajo obtenida exitosamente',
    type: PaginatedOrdenesTrabajoResponseDto,
  })
  findAll(@Query() filters?: FilterOrdenTrabajoDto) {
    return this.ordenesTrabajoService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una orden de trabajo por ID' })
  @ApiParam({ name: 'id', description: 'ID de la orden de trabajo' })
  @ApiResponse({
    status: 200,
    description: 'Orden de trabajo encontrada',
    type: OrdenTrabajoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Orden de trabajo no encontrada' })
  findOne(@Param('id') id: string) {
    return this.ordenesTrabajoService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar estado y observaciones de una orden de trabajo',
    description:
      'Permite actualizar el estado y las observaciones de una orden de trabajo. Al cambiar el estado a "en_proceso" se establece automáticamente la fecha de inicio si no existe. Al cambiar a "completada" se establece la fecha de completación.',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de trabajo' })
  @ApiResponse({
    status: 200,
    description: 'Orden de trabajo actualizada exitosamente',
    type: OrdenTrabajoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Orden de trabajo no encontrada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  update(@Param('id') id: string, @Body() updateDto: UpdateOrdenTrabajoDto) {
    return this.ordenesTrabajoService.update(id, updateDto);
  }
}
