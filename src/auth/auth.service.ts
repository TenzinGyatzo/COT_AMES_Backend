import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UsuarioCliente } from '../clientes/schemas/usuario-cliente.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, passwordPlain: string): Promise<any> {
    // Usar findByEmailWithPassword para obtener passwordHash debido a select: false
    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user) {
      return null;
    }

    // Verificar que el usuario esté activo
    if (!user.activo) {
      return null;
    }

    // Comparar contraseñas
    const isPasswordValid = await bcrypt.compare(
      passwordPlain,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      return null;
    }

    // Devolver usuario sin passwordHash
    const { ...result } = user.toObject();
    return result;
  }

  async login(user: any) {
    const payload = {
      sub: user._id,
      email: user.email,
      rol: user.rol,
      tipoUsuario: 'admin',
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        _id: user._id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        tipoUsuario: 'admin',
        activo: user.activo,
      },
    };
  }

  async loginCliente(usuarioCliente: UsuarioCliente | any) {
    const usuarioDoc = usuarioCliente as any;
    const clienteId = usuarioDoc.clienteId
      ? usuarioDoc.clienteId.toString()
      : usuarioCliente.clienteId?.toString() || null;
    const userId = usuarioDoc._id?.toString() || usuarioDoc.id?.toString();

    const payload = {
      sub: userId,
      email: usuarioCliente.email,
      tipoUsuario: 'cliente',
      clienteId: clienteId,
      rol: 'cliente',
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        _id: userId,
        email: usuarioCliente.email,
        nombre: usuarioCliente.nombre,
        rol: 'cliente',
        tipoUsuario: 'cliente',
        clienteId: clienteId,
        activo: usuarioCliente.activo,
      },
    };
  }
}
