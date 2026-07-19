import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Roles } from '../enums/roles.enum';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('No autorizado');
    }

    if (user.rol === Roles.ADMIN_SISTEMA) {
      return true;
    }

    throw new ForbiddenException(
      'Solo el administrador de sistema puede acceder a este recurso',
    );
  }
}
