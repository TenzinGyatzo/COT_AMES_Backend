import { AsyncLocalStorage } from 'async_hooks';
import { Types } from 'mongoose';

/** Tenant efectivo del request (AD-2). Node built-in — sin nestjs-cls. */
export const tenantAls = new AsyncLocalStorage<Types.ObjectId>();
