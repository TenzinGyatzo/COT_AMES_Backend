import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ServicioDocument = Servicio & Document;

@Schema({ timestamps: true })
export class Servicio {
  @Prop({ type: Types.ObjectId, ref: 'Sede', required: true })
  sedeId: Types.ObjectId;

  @Prop()
  claveSede?: string;

  @Prop({ required: true })
  nombre: string;

  @Prop()
  descripcion?: string;

  @Prop({ required: true, min: 0 })
  precioUnitario: number;

  @Prop({ default: 'MXN' })
  moneda: string;

  @Prop({ default: true })
  activo: boolean;
}

export const ServicioSchema = SchemaFactory.createForClass(Servicio);
