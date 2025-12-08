import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { TipoUsuario } from '../enums/tipo-usuario.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('No autorizado');
    }

    // Validar tipo de usuario
    if (requiredRoles.includes('admin')) {
      if (user.tipoUsuario !== TipoUsuario.ADMIN) {
        throw new ForbiddenException(
          'Solo administradores pueden acceder a este recurso',
        );
      }
    }

    // Validar rol
    const hasRole = requiredRoles.some((role) => user.rol === role);
    if (!hasRole) {
      throw new ForbiddenException('No tiene el rol necesario');
    }

    return true;
  }
}
