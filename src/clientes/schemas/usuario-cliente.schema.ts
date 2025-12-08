import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UsuarioClienteDocument = UsuarioCliente & Document;

@Schema({ timestamps: true })
export class UsuarioCliente {
  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true })
  nombre: string;

  @Prop()
  telefono?: string;

  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true, index: true })
  clienteId: Types.ObjectId;

  @Prop({ default: true })
  activo: boolean;
}

export const UsuarioClienteSchema =
  SchemaFactory.createForClass(UsuarioCliente);
