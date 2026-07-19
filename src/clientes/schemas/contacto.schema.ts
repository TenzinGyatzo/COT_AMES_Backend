import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ContactoDocument = Contacto & Document;

@Schema({ timestamps: true })
export class Contacto {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true, index: true })
  clienteId: Types.ObjectId;

  /** Obligatorio (FR-13). */
  @Prop({ required: true })
  nombre: string;

  /** Opcional. */
  @Prop()
  correo?: string;

  @Prop()
  telefono?: string;

  @Prop()
  cargo?: string;

  @Prop({ default: true })
  activo: boolean;
}

export const ContactoSchema = SchemaFactory.createForClass(Contacto);

ContactoSchema.index({ tenantId: 1, clienteId: 1 });
ContactoSchema.index({ tenantId: 1, clienteId: 1, activo: 1 });
