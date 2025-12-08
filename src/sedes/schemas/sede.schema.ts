import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { EstadoMexico } from '../enums/estado-mexico.enum';

export type SedeDocument = Sede & Document;

@Schema({ timestamps: true })
export class Sede {
  @Prop()
  clave?: string;

  @Prop({ required: true })
  ciudad: string;

  @Prop({
    type: String,
    enum: Object.values(EstadoMexico),
  })
  estado?: EstadoMexico;

  @Prop({ default: true })
  activo: boolean;
}

export const SedeSchema = SchemaFactory.createForClass(Sede);
