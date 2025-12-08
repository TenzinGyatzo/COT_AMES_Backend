import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SedesService } from './sedes.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/enums/roles.enum';
import { Roles as RolesDecorator } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('sedes')
@Controller('sedes')
export class SedesController {
  constructor(private readonly sedesService: SedesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear una nueva sede' })
  @ApiResponse({
    status: 201,
    description: 'Sede creada exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@Body() createSedeDto: CreateSedeDto) {
    return this.sedesService.create(createSedeDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Listar todas las sedes' })
  @ApiResponse({
    status: 200,
    description: 'Lista de sedes obtenida exitosamente',
  })
  findAll() {
    return this.sedesService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Obtener una sede por ID' })
  @ApiParam({ name: 'id', description: 'ID de la sede' })
  @ApiResponse({
    status: 200,
    description: 'Sede encontrada',
  })
  @ApiResponse({ status: 404, description: 'Sede no encontrada' })
  findOne(@Param('id') id: string) {
    return this.sedesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar una sede' })
  @ApiParam({ name: 'id', description: 'ID de la sede' })
  @ApiResponse({
    status: 200,
    description: 'Sede actualizada exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Sede no encontrada' })
  update(@Param('id') id: string, @Body() updateSedeDto: UpdateSedeDto) {
    return this.sedesService.update(id, updateSedeDto);
  }

  @Patch(':id/toggle-activo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar o desactivar una sede' })
  @ApiParam({ name: 'id', description: 'ID de la sede' })
  @ApiResponse({
    status: 200,
    description: 'Estado de la sede cambiado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Sede no encontrada' })
  toggleActivo(@Param('id') id: string) {
    return this.sedesService.toggleActivo(id);
  }
}
