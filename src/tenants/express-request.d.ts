import { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      /** Tenant efectivo resuelto por TenantContextGuard (AD-2). */
      effectiveTenantId?: Types.ObjectId;
    }
  }
}

export {};
