import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TenantDocument = Tenant & Document;

@Schema({ timestamps: true })
export class Tenant {
  @Prop({ required: true })
  nombre: string;

  @Prop({ required: true, unique: true, index: true })
  clave: string;

  @Prop({ default: true })
  activo: boolean;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
