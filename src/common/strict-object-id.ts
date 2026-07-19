import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

/** ObjectId hex de 24 chars — más estricto que `Types.ObjectId.isValid`. */
const OBJECT_ID_HEX = /^[a-fA-F0-9]{24}$/;

export function isStrictObjectId(value: string): boolean {
  return OBJECT_ID_HEX.test(value) && Types.ObjectId.isValid(value);
}

/** Evita CastError 500; cross-tenant e ID malformado → mismo 404. */
export function assertStrictObjectIdOrNotFound(
  id: string,
  resourceLabel: string,
): void {
  if (!isStrictObjectId(id)) {
    throw new NotFoundException(`${resourceLabel} con ID ${id} no encontrado`);
  }
}
