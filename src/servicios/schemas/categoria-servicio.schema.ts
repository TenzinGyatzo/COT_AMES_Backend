import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CategoriaServicioDocument = CategoriaServicioEntity & Document;

/** Categoría dinámica de catálogo por tenant (Story 5.1 / AD-20). */
@Schema({ timestamps: true, collection: 'categorias_servicio' })
export class CategoriaServicioEntity {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true })
  nombre: string;

  /** Código de 2–3 caracteres; siempre uppercase; único por tenant. */
  @Prop({ required: true })
  codigo: string;

  @Prop({ default: true })
  activo: boolean;
}

export const CategoriaServicioSchema = SchemaFactory.createForClass(
  CategoriaServicioEntity,
);

CategoriaServicioSchema.index({ tenantId: 1, codigo: 1 }, { unique: true });
