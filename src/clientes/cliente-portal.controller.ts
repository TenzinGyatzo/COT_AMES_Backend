import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClienteGuard } from '../auth/guards/cliente.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClientesService } from './clientes.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';
import { UpdateMiPerfilDto } from './dto/update-mi-perfil.dto';
import { FilterMisCotizacionesDto } from '../cotizaciones/dto/filter-mis-cotizaciones.dto';
import { CreateCotizacionClienteDto } from '../cotizaciones/dto/create-cotizacion-cliente.dto';
import { PaginatedCotizacionesResponseDto } from '../cotizaciones/dto/paginated-cotizaciones-response.dto';

@ApiTags('cliente-portal')
@Controller('cliente-portal')
@UseGuards(JwtAuthGuard, ClienteGuard)
@ApiBearerAuth()
export class ClientePortalController {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly cotizacionesService: CotizacionesService,
  ) {}

  @Get('mi-perfil')
  @ApiOperation({
    summary: 'Obtener perfil del usuario cliente y su empresa',
    description:
      'Retorna los datos del usuario cliente autenticado y la información de su empresa',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        usuario: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            nombre: { type: 'string' },
            email: { type: 'string' },
            telefono: { type: 'string' },
            clienteId: { type: 'string' },
            activo: { type: 'boolean' },
          },
        },
        cliente: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            empresa: { type: 'string' },
            rfc: { type: 'string' },
            sedeId: { type: 'string' },
            clave: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Usuario o cliente no encontrado' })
  async getMiPerfil(@CurrentUser() user: any) {
    const usuarioCliente = await this.clientesService.findUsuarioClienteById(
      user._id,
    );
    const cliente = await this.clientesService.findOne(user.clienteId);

    const usuarioDoc = usuarioCliente as any;
    const clienteDoc = cliente as any;

    return {
      usuario: {
        _id: usuarioDoc._id?.toString() || usuarioDoc.id?.toString(),
        nombre: usuarioCliente.nombre,
        email: usuarioCliente.email,
        telefono: usuarioCliente.telefono,
        clienteId:
          usuarioDoc.clienteId?.toString() ||
          usuarioCliente.clienteId?.toString(),
        activo: usuarioCliente.activo,
      },
      cliente: {
        _id: clienteDoc._id?.toString() || clienteDoc.id?.toString(),
        empresa: cliente.empresa,
        rfc: cliente.rfc,
        sedeId: clienteDoc.sedeId?.toString() || cliente.sedeId?.toString(),
        clave: cliente.clave,
      },
    };
  }

  @Patch('mi-perfil')
  @ApiOperation({
    summary: 'Actualizar perfil del usuario cliente',
    description:
      'Permite actualizar el nombre, email y teléfono del usuario cliente',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil actualizado exitosamente',
    schema: {
      type: 'object',
      properties: {
        usuario: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            nombre: { type: 'string' },
            email: { type: 'string' },
            telefono: { type: 'string' },
            clienteId: { type: 'string' },
            activo: { type: 'boolean' },
          },
        },
        cliente: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            empresa: { type: 'string' },
            rfc: { type: 'string' },
            sedeId: { type: 'string' },
            clave: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'El email ya está registrado' })
  async updateMiPerfil(
    @CurrentUser() user: any,
    @Body() updateDto: UpdateMiPerfilDto,
  ) {
    // Actualizar usuario cliente si viene nombre, email o telefono
    const updateUsuarioData: any = {};
    if (updateDto.nombre) {
      updateUsuarioData.nombre = updateDto.nombre;
    }
    if (updateDto.email) {
      updateUsuarioData.email = updateDto.email;
    }
    if (updateDto.telefono !== undefined) {
      updateUsuarioData.telefono = updateDto.telefono;
    }

    if (Object.keys(updateUsuarioData).length > 0) {
      await this.clientesService.updateUsuarioCliente(
        user._id,
        updateUsuarioData,
      );
    }

    // Retornar perfil actualizado
    return this.getMiPerfil(user);
  }

  @Get('mis-cotizaciones')
  @ApiOperation({
    summary: 'Listar cotizaciones del usuario cliente autenticado',
    description:
      'Retorna las cotizaciones del usuario cliente autenticado con paginación y filtros opcionales. Solo muestra las cotizaciones que el usuario específico ha creado, no las de otros usuarios de la misma empresa.',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: [
      'vigente',
      'vencida',
      'aceptada',
      'rechazada',
      'en_proceso',
      'completada',
    ],
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
    description: 'Lista de cotizaciones obtenida exitosamente',
    type: PaginatedCotizacionesResponseDto,
  })
  async getMisCotizaciones(
    @CurrentUser() user: any,
    @Query() filters?: FilterMisCotizacionesDto,
  ): Promise<PaginatedCotizacionesResponseDto> {
    return this.cotizacionesService.findByUsuarioClienteId(
      user._id,
      user.clienteId,
      filters,
    );
  }

  @Get('mis-cotizaciones/:id')
  @ApiOperation({
    summary: 'Obtener detalle de una cotización específica',
    description:
      'Retorna el detalle completo de una cotización que pertenece al usuario cliente autenticado',
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiResponse({
    status: 200,
    description: 'Cotización encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'Cotización no encontrada o no pertenece a su usuario',
  })
  async getMiCotizacion(@CurrentUser() user: any, @Param('id') id: string) {
    return this.cotizacionesService.findOneByUsuarioClienteId(
      id,
      user._id,
      user.clienteId,
    );
  }

  @Post('cotizaciones')
  @ApiOperation({
    summary: 'Crear una nueva cotización autenticada',
    description:
      'Permite al cliente autenticado crear una nueva cotización usando su clienteId automáticamente',
  })
  @ApiResponse({
    status: 201,
    description: 'Cotización creada exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({
    status: 404,
    description: 'Sede o servicio no encontrado',
  })
  async createCotizacion(
    @CurrentUser() user: any,
    @Body() createDto: CreateCotizacionClienteDto,
  ) {
    return this.cotizacionesService.createFromCliente(
      user.clienteId,
      createDto,
      user._id,
    );
  }

  @Post('cotizaciones/:id/repetir')
  @ApiOperation({
    summary: 'Repetir una cotización anterior',
    description:
      'Crea una nueva cotización basada en una anterior, actualizando precios y generando nuevo folio. Solo puede repetir cotizaciones que pertenezcan al usuario autenticado.',
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización a repetir' })
  @ApiResponse({
    status: 201,
    description: 'Cotización repetida exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cotización no encontrada o no pertenece a su usuario',
  })
  async repetirCotizacion(@CurrentUser() user: any, @Param('id') id: string) {
    return this.cotizacionesService.repetirCotizacion(
      id,
      user.clienteId,
      user._id,
    );
  }

  @Patch('mis-cotizaciones/:id/aceptar')
  @ApiOperation({
    summary: 'Aceptar una cotización',
    description:
      'Acepta una cotización vigente y genera automáticamente una orden de trabajo. La cotización debe estar en estado vigente y no vencida. Solo puede aceptar cotizaciones que pertenezcan al usuario autenticado.',
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización a aceptar' })
  @ApiResponse({
    status: 200,
    description: 'Cotización aceptada exitosamente y orden de trabajo creada',
  })
  @ApiResponse({
    status: 400,
    description:
      'La cotización no puede ser aceptada (ya aceptada/rechazada o vencida)',
  })
  @ApiResponse({
    status: 404,
    description: 'Cotización no encontrada o no pertenece a su usuario',
  })
  async aceptarCotizacion(@CurrentUser() user: any, @Param('id') id: string) {
    return this.cotizacionesService.aceptarCotizacion(
      id,
      user._id,
      user.clienteId,
    );
  }

  @Patch('mis-cotizaciones/:id/rechazar')
  @ApiOperation({
    summary: 'Rechazar una cotización',
    description:
      'Rechaza una cotización vigente. La cotización rechazada permanecerá visible en el historial. Solo puede rechazar cotizaciones que pertenezcan al usuario autenticado.',
  })
  @ApiParam({ name: 'id', description: 'ID de la cotización a rechazar' })
  @ApiResponse({
    status: 200,
    description: 'Cotización rechazada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'La cotización no puede ser rechazada (ya aceptada/rechazada)',
  })
  @ApiResponse({
    status: 404,
    description: 'Cotización no encontrada o no pertenece a su usuario',
  })
  async rechazarCotizacion(@CurrentUser() user: any, @Param('id') id: string) {
    return this.cotizacionesService.rechazarCotizacion(
      id,
      user.clienteId,
      user._id,
    );
  }
}
