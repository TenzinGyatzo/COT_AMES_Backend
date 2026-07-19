import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  CategoriaServicio,
  CATEGORIA_SERVICIO_VALUES,
} from '../enums/categoria-servicio.enum';

export type ServicioDocument = Servicio & Document;

@Schema({ timestamps: true })
export class Servicio {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  nombre: string;

  @Prop()
  descripcion?: string;

  @Prop({ required: true, min: 0 })
  precioUnitario: number;

  @Prop({
    required: true,
    enum: CATEGORIA_SERVICIO_VALUES,
  })
  categoria: CategoriaServicio;

  @Prop({ default: 'MXN' })
  moneda: string;

  @Prop({ default: true })
  activo: boolean;
}

export const ServicioSchema = SchemaFactory.createForClass(Servicio);

ServicioSchema.index({ tenantId: 1, nombre: 1 });
ServicioSchema.index({ tenantId: 1, categoria: 1 });
