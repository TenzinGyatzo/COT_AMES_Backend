import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { Roles } from './enums/roles.enum';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un nuevo usuario',
    description:
      'Permite crear el primer usuario administrador si no existe ninguno en la base de datos. Si ya existe al menos un usuario, solo permite registro si hay un usuario autenticado con rol admin.',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado exitosamente',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'El email ya está registrado' })
  @ApiResponse({
    status: 403,
    description: 'No autorizado para crear usuarios',
  })
  async register(@Body() registerDto: RegisterDto, @Request() req: any) {
    const userCount = await this.usersService.count();

    // Si no hay usuarios, permitir crear el primer admin
    if (userCount === 0) {
      const user = await this.usersService.create({
        ...registerDto,
        rol: Roles.ADMIN,
      });
      const { passwordHash, ...result } = user.toObject();
      return result;
    }

    // Si ya hay usuarios, verificar si hay un usuario autenticado con rol admin
    // El usuario puede estar en req.user si pasó por JwtAuthGuard (opcional)
    const currentUser = req.user;
    if (currentUser && currentUser.rol === Roles.ADMIN) {
      const user = await this.usersService.create(registerDto);
      const { passwordHash, ...result } = user.toObject();
      return result;
    }

    // Si no hay usuario autenticado o no es admin, denegar
    throw new ForbiddenException(
      'Solo un administrador autenticado puede crear nuevos usuarios',
    );
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description: 'Autentica un usuario y devuelve un token JWT',
  })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        user: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            email: { type: 'string' },
            nombre: { type: 'string' },
            rol: { type: 'string' },
            activo: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() loginDto: LoginDto, @CurrentUser() user: any) {
    return this.authService.login(user);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener perfil del usuario autenticado',
    description: 'Devuelve los datos del usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil del usuario',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getProfile(@CurrentUser() user: any) {
    const fullUser = await this.usersService.findById(user._id);
    const { passwordHash, ...result } = fullUser.toObject();
    return result;
  }
}
