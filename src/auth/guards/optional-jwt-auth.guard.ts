import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Populate `req.user` when a Bearer JWT is present; allow unauthenticated
 * requests through (bootstrap register when DB has zero users).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers?.authorization;
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: any, user: TUser): TUser | null {
    if (err || !user) {
      return null;
    }
    return user;
  }
}
