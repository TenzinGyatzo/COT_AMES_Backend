import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClienteDocument = Cliente & Document;

@Schema({ timestamps: true })
export class Cliente {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  empresa: string;

  /** Opcional (FR-10). Único por tenant cuando existe. */
  @Prop()
  rfc?: string;

  @Prop({ default: true })
  activo: boolean;
}

export const ClienteSchema = SchemaFactory.createForClass(Cliente);

ClienteSchema.index({ tenantId: 1, empresa: 1 });
ClienteSchema.index(
  { tenantId: 1, rfc: 1 },
  {
    unique: true,
    // Solo activos: permite reutilizar RFC tras soft-delete (Story 3.2 / review 3.1)
    partialFilterExpression: {
      rfc: { $type: 'string', $gt: '' },
      activo: true,
    },
  },
);
