import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
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
import { PaginatedOrdenesTrabajoResponseDto } from './dto/paginated-ordenes-trabajo-response.dto';
import { OrdenTrabajoResponseDto } from './dto/orden-trabajo-response.dto';
import { CreateTrabajadorDto } from './dto/create-trabajador.dto';
import { UpdateTrabajadorDto } from './dto/update-trabajador.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClienteGuard } from '../auth/guards/cliente.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('cliente-portal')
@Controller('cliente-portal')
@UseGuards(JwtAuthGuard, ClienteGuard)
@ApiBearerAuth()
export class ClientePortalOrdenesController {
  constructor(private readonly ordenesTrabajoService: OrdenesTrabajoService) {}

  @Get('mis-ordenes')
  @ApiOperation({
    summary: 'Listar órdenes de trabajo del usuario cliente autenticado',
    description:
      'Retorna las órdenes de trabajo del usuario cliente autenticado con paginación y filtros opcionales. Solo muestra las órdenes que el usuario específico generó.',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['pendiente', 'en_proceso', 'completada', 'cancelada'],
    description: 'Filtrar por estado',
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
  @ApiResponse({
    status: 200,
    description: 'Lista de órdenes de trabajo obtenida exitosamente',
    type: PaginatedOrdenesTrabajoResponseDto,
  })
  async getMisOrdenes(
    @CurrentUser() user: any,
    @Query('estado') estado?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedOrdenesTrabajoResponseDto> {
    return this.ordenesTrabajoService.findByUsuarioClienteId(user._id, {
      estado,
      fechaDesde,
      fechaHasta,
      page,
      limit,
    });
  }

  @Get('mis-ordenes/:id')
  @ApiOperation({
    summary: 'Obtener detalle de una orden de trabajo específica',
    description:
      'Retorna el detalle completo de una orden de trabajo que pertenece al usuario cliente autenticado',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de trabajo' })
  @ApiResponse({
    status: 200,
    description: 'Orden de trabajo encontrada',
    type: OrdenTrabajoResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada o no pertenece a su usuario',
  })
  async getMiOrden(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<OrdenTrabajoResponseDto> {
    return this.ordenesTrabajoService.findOneByUsuarioCliente(id, user._id);
  }

  @Post('mis-ordenes/:id/trabajadores')
  @ApiOperation({
    summary: 'Agregar un trabajador a una orden de trabajo',
    description:
      'Agrega un nuevo trabajador a una orden de trabajo que pertenece al usuario cliente autenticado',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de trabajo' })
  @ApiResponse({
    status: 200,
    description: 'Trabajador agregado exitosamente',
    type: OrdenTrabajoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o límite de trabajadores alcanzado',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada o no pertenece a su usuario',
  })
  async agregarTrabajador(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() trabajadorDto: CreateTrabajadorDto,
  ): Promise<OrdenTrabajoResponseDto> {
    return this.ordenesTrabajoService.agregarTrabajador(
      id,
      user._id,
      trabajadorDto,
    );
  }

  @Patch('mis-ordenes/:id/trabajadores/:index')
  @ApiOperation({
    summary: 'Actualizar un trabajador de una orden de trabajo',
    description:
      'Actualiza la información de un trabajador específico en una orden de trabajo que pertenece al usuario cliente autenticado',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de trabajo' })
  @ApiParam({
    name: 'index',
    description: 'Índice del trabajador en el array (base 0)',
  })
  @ApiResponse({
    status: 200,
    description: 'Trabajador actualizado exitosamente',
    type: OrdenTrabajoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o índice inválido',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada o no pertenece a su usuario',
  })
  async actualizarTrabajador(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('index') index: string,
    @Body() trabajadorDto: UpdateTrabajadorDto,
  ): Promise<OrdenTrabajoResponseDto> {
    return this.ordenesTrabajoService.actualizarTrabajador(
      id,
      user._id,
      parseInt(index, 10),
      trabajadorDto,
    );
  }

  @Delete('mis-ordenes/:id/trabajadores/:index')
  @ApiOperation({
    summary: 'Eliminar un trabajador de una orden de trabajo',
    description:
      'Elimina un trabajador específico de una orden de trabajo que pertenece al usuario cliente autenticado. Debe haber al menos un trabajador en la orden.',
  })
  @ApiParam({ name: 'id', description: 'ID de la orden de trabajo' })
  @ApiParam({
    name: 'index',
    description: 'Índice del trabajador en el array (base 0)',
  })
  @ApiResponse({
    status: 200,
    description: 'Trabajador eliminado exitosamente',
    type: OrdenTrabajoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'No se puede eliminar (debe haber al menos un trabajador) o índice inválido',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden de trabajo no encontrada o no pertenece a su usuario',
  })
  async eliminarTrabajador(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('index') index: string,
  ): Promise<OrdenTrabajoResponseDto> {
    return this.ordenesTrabajoService.eliminarTrabajador(
      id,
      user._id,
      parseInt(index, 10),
    );
  }
}
