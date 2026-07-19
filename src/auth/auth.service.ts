import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, passwordPlain: string): Promise<any> {
    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user) {
      return null;
    }

    if (!user.activo) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(
      passwordPlain,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      return null;
    }

    const { ...result } = user.toObject();
    return result;
  }

  async login(user: any) {
    const payload: Record<string, unknown> = {
      sub: user._id,
      email: user.email,
      rol: user.rol,
      tipoUsuario: user.rol,
    };
    if (user.tenantId) {
      payload.tenantId = user.tenantId;
    }
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        _id: user._id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        tipoUsuario: user.rol,
        tenantId: user.tenantId,
        activo: user.activo,
      },
    };
  }
}
