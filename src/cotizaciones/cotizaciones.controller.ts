import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
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
import { CotizacionesService } from './cotizaciones.service';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto';
import { FilterCotizacionDto } from './dto/filter-cotizacion.dto';
import { PaginatedCotizacionesResponseDto } from './dto/paginated-cotizaciones-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/enums/roles.enum';
import { Roles as RolesDecorator } from '../auth/decorators/roles.decorator';

@ApiTags('cotizaciones')
@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly cotizacionesService: CotizacionesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear una nueva cotización' })
  @ApiResponse({
    status: 201,
    description: 'Cotización creada exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({
    status: 404,
    description: 'Cliente, sede o servicio no encontrado',
  })
  create(@Body() createCotizacionDto: CreateCotizacionDto) {
    return this.cotizacionesService.create(createCotizacionDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar cotizaciones con filtros opcionales y paginación',
    description:
      'Endpoint administrativo para listar cotizaciones con filtros avanzados, búsqueda por texto y paginación. Permite filtrar por estado, sede, fechas y buscar por empresa o RFC del cliente.',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['vigente', 'vencida', 'aceptada', 'rechazada'],
    description: 'Filtrar por estado de la cotización',
  })
  @ApiQuery({
    name: 'sedeId',
    required: false,
    type: String,
    description: 'Filtrar por ID de sede',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Búsqueda por empresa o RFC del cliente',
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
    description: 'Lista paginada de cotizaciones obtenida exitosamente',
    type: PaginatedCotizacionesResponseDto,
  })
  findAll(@Query() filters?: FilterCotizacionDto) {
    return this.cotizacionesService.findAll(filters);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener una cotización por ID' })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiResponse({
    status: 200,
    description: 'Cotización encontrada',
  })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  findOne(@Param('id') id: string) {
    return this.cotizacionesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar una cotización' })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiResponse({
    status: 200,
    description: 'Cotización actualizada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  update(
    @Param('id') id: string,
    @Body() updateCotizacionDto: UpdateCotizacionDto,
  ) {
    return this.cotizacionesService.update(id, updateCotizacionDto);
  }

  @Patch(':id/marcar-vencida')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar una cotización específica como vencida' })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiResponse({
    status: 200,
    description: 'Cotización marcada como vencida exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  marcarVencida(@Param('id') id: string) {
    return this.cotizacionesService.marcarVencida(id);
  }

  @Patch('mark-expired')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar todas las cotizaciones vencidas automáticamente',
    description:
      'Marca como vencidas todas las cotizaciones cuya fecha de vencimiento haya pasado y aún estén en estado vigente. Este endpoint puede ser llamado manualmente o configurado como tarea programada (cron) en el futuro.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cotizaciones vencidas marcadas exitosamente',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Se marcaron 5 cotizaciones como vencidas',
        },
        count: {
          type: 'number',
          example: 5,
        },
      },
    },
  })
  async markExpired() {
    const count = await this.cotizacionesService.markExpiredQuotations();
    return {
      message: `Se marcaron ${count} cotización(es) como vencida(s)`,
      count,
    };
  }
}
