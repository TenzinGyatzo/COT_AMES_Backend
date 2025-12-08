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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ServiciosService } from './servicios.service';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { CreateServicioGlobalDto } from './dto/create-servicio-global.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';
import { FilterServicioDto } from './dto/filter-servicio.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/enums/roles.enum';
import { Roles as RolesDecorator } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('servicios')
@Controller('servicios')
export class ServiciosController {
  constructor(private readonly serviciosService: ServiciosService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un nuevo servicio' })
  @ApiResponse({
    status: 201,
    description: 'Servicio creado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Sede no encontrada' })
  create(@Body() createServicioDto: CreateServicioDto) {
    return this.serviciosService.create(createServicioDto);
  }

  @Post('create-for-all-sedes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un servicio en todas las sedes' })
  @ApiResponse({
    status: 201,
    description: 'Servicios creados exitosamente en todas las sedes',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o no hay sedes disponibles',
  })
  createForAllSedes(@Body() createServicioGlobalDto: CreateServicioGlobalDto) {
    return this.serviciosService.createForAllSedes(createServicioGlobalDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Listar servicios con filtros opcionales' })
  @ApiQuery({ name: 'sedeId', required: false, type: String })
  @ApiQuery({ name: 'activo', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Lista de servicios obtenida exitosamente',
  })
  findAll(@Query() filters?: FilterServicioDto) {
    return this.serviciosService.findAll(filters);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Obtener un servicio por ID' })
  @ApiParam({ name: 'id', description: 'ID del servicio' })
  @ApiResponse({
    status: 200,
    description: 'Servicio encontrado',
  })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  findOne(@Param('id') id: string) {
    return this.serviciosService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar un servicio' })
  @ApiParam({ name: 'id', description: 'ID del servicio' })
  @ApiResponse({
    status: 200,
    description: 'Servicio actualizado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  update(
    @Param('id') id: string,
    @Body() updateServicioDto: UpdateServicioDto,
  ) {
    return this.serviciosService.update(id, updateServicioDto);
  }

  @Patch(':id/toggle-activo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar o desactivar un servicio' })
  @ApiParam({ name: 'id', description: 'ID del servicio' })
  @ApiResponse({
    status: 200,
    description: 'Estado del servicio cambiado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  toggleActivo(@Param('id') id: string) {
    return this.serviciosService.toggleActivo(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar completamente un servicio de la base de datos',
  })
  @ApiParam({ name: 'id', description: 'ID del servicio' })
  @ApiResponse({
    status: 204,
    description: 'Servicio eliminado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  remove(@Param('id') id: string) {
    return this.serviciosService.remove(id);
  }
}
