import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClienteDocument = Cliente & Document;

@Schema({ timestamps: true })
export class Cliente {
  @Prop({ unique: true, index: true, sparse: true })
  clave?: string;

  @Prop({ required: true })
  empresa: string;

  @Prop({ required: true, unique: true, index: true })
  rfc: string;

  @Prop({ type: Types.ObjectId, ref: 'Sede' })
  sedeId?: Types.ObjectId;

  @Prop({ default: true })
  activo: boolean;
}

export const ClienteSchema = SchemaFactory.createForClass(Cliente);
