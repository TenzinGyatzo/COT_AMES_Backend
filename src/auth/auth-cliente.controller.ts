import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ClientesService } from '../clientes/clientes.service';
import { RegisterClienteCompletoDto } from '../clientes/dto/register-cliente-completo.dto';
import { LoginClienteDto } from '../clientes/dto/login-cliente.dto';
import { UsuarioClienteResponseDto } from '../clientes/dto/usuario-cliente-response.dto';

@ApiTags('auth-cliente')
@Controller('auth/cliente')
export class AuthClienteController {
  constructor(
    private authService: AuthService,
    private clientesService: ClientesService,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registra un nuevo usuario cliente',
    description:
      'Registra un usuario cliente. Puede crear una nueva empresa o unirse a una empresa existente.\n\n' +
      '- Si se proporciona claveEmpresa: busca un Cliente existente con esa clave y asocia el nuevo usuario a ese Cliente.\n' +
      '- Si NO se proporciona claveEmpresa: busca o crea un nuevo Cliente automáticamente (comportamiento original).\n\n' +
      'Ideal para:\n' +
      '1. Nuevos clientes que se registran por primera vez (no proporcionar claveEmpresa)\n' +
      '2. Usuarios adicionales que se unen a una empresa existente (proporcionar claveEmpresa)\n\n' +
      'La clave de la empresa puede ser obtenida del perfil de cualquier usuario ya registrado en esa empresa.',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario cliente registrado exitosamente',
    type: UsuarioClienteResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'El email ya está registrado' })
  async register(@Body() registerDto: RegisterClienteCompletoDto) {
    const usuarioCliente =
      await this.clientesService.registerClienteCompleto(registerDto);
    const usuarioDoc = usuarioCliente as any;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = usuarioDoc.toObject();
    return result;
  }

  @Get('buscar-empresa/:clave')
  @ApiOperation({
    summary: 'Busca información de una empresa por su clave',
    description:
      'Endpoint público que permite buscar información básica de una empresa usando su clave única. Útil para que nuevos usuarios verifiquen la empresa antes de registrarse.',
  })
  @ApiResponse({
    status: 200,
    description: 'Empresa encontrada',
    schema: {
      type: 'object',
      properties: {
        empresa: { type: 'string' },
        rfc: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Empresa no encontrada' })
  async buscarEmpresaPorClave(@Param('clave') clave: string) {
    const cliente = await this.clientesService.findByClave(clave.toUpperCase());

    if (!cliente) {
      throw new NotFoundException(
        'Empresa no encontrada con la clave proporcionada',
      );
    }

    if (!cliente.activo) {
      throw new NotFoundException('La empresa está inactiva');
    }

    return {
      empresa: cliente.empresa,
      rfc: cliente.rfc,
    };
  }

  @Get('verificar-rfc/:rfc')
  @ApiOperation({
    summary: 'Verifica si un RFC ya está registrado',
    description:
      'Endpoint público que permite verificar si un RFC ya está registrado en el sistema. Útil para prevenir registros duplicados.',
  })
  @ApiResponse({
    status: 200,
    description: 'RFC verificado',
    schema: {
      type: 'object',
      properties: {
        existe: { type: 'boolean' },
        empresa: { type: 'string', nullable: true },
        clave: { type: 'string', nullable: true },
      },
    },
  })
  async verificarRfc(@Param('rfc') rfc: string) {
    const cliente = await this.clientesService.findByRfc(rfc.toUpperCase());

    if (!cliente) {
      return {
        existe: false,
        empresa: null,
        clave: null,
      };
    }

    if (!cliente.activo) {
      return {
        existe: false,
        empresa: null,
        clave: null,
      };
    }

    return {
      existe: true,
      empresa: cliente.empresa,
      clave: cliente.clave,
    };
  }

  @Get('verificar-empresa/:empresa')
  @ApiOperation({
    summary: 'Verifica si un nombre de empresa ya está registrado',
    description:
      'Endpoint público que permite verificar si un nombre de empresa ya está registrado en el sistema. Útil para prevenir registros duplicados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Nombre de empresa verificado',
    schema: {
      type: 'object',
      properties: {
        existe: { type: 'boolean' },
        rfc: { type: 'string', nullable: true },
        clave: { type: 'string', nullable: true },
      },
    },
  })
  async verificarEmpresa(@Param('empresa') empresa: string) {
    const cliente = await this.clientesService.findByEmpresa(empresa.trim());

    if (!cliente) {
      return {
        existe: false,
        rfc: null,
        clave: null,
      };
    }

    if (!cliente.activo) {
      return {
        existe: false,
        rfc: null,
        clave: null,
      };
    }

    return {
      existe: true,
      rfc: cliente.rfc,
      clave: cliente.clave,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión como usuario cliente' })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            email: { type: 'string' },
            nombre: { type: 'string' },
            clienteId: { type: 'string' },
            activo: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() loginDto: LoginClienteDto) {
    const usuarioCliente = await this.clientesService.validateUsuarioCliente(
      loginDto.email,
      loginDto.password,
    );

    if (!usuarioCliente) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.authService.loginCliente(usuarioCliente);
  }
}
