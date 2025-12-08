import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { TipoUsuario } from '../enums/tipo-usuario.enum';
import { Roles } from '../enums/roles.enum';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('No autorizado');
    }

    if (user.tipoUsuario === TipoUsuario.ADMIN && user.rol === Roles.ADMIN) {
      return true;
    }

    throw new ForbiddenException(
      'Solo administradores pueden acceder a este recurso',
    );
  }
}
