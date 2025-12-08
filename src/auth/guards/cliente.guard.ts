import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { TipoUsuario } from '../enums/tipo-usuario.enum';

@Injectable()
export class ClienteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('No autorizado');
    }

    if (user.tipoUsuario === TipoUsuario.CLIENTE) {
      return true;
    }

    throw new ForbiddenException(
      'Solo usuarios cliente pueden acceder a este recurso',
    );
  }
}
