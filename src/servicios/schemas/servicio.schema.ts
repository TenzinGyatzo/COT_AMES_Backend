import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CategoriaServicioEntity } from './categoria-servicio.schema';
import { TipoItem, TIPO_ITEM_VALUES } from '../enums/tipo-item.enum';

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

  /** Categoría dinámica del tenant (Story 5.3 / AD-20). */
  @Prop({
    type: Types.ObjectId,
    ref: CategoriaServicioEntity.name,
    required: true,
  })
  categoriaId: Types.ObjectId;

  @Prop({ default: 'MXN' })
  moneda: string;

  /**
   * Discriminador catálogo unificado (AD-19 / FR-58 / Story 6.1).
   * Default al construir docs nuevos; findAll(tipo=servicio) también
   * incluye docs sin campo / null (legacy post-5.4).
   */
  @Prop({
    required: true,
    enum: TIPO_ITEM_VALUES,
    default: TipoItem.SERVICIO,
  })
  tipo: TipoItem;

  /**
   * Código interno opcional (AD-21 / FR-59 / Story 6.2).
   * Vacío → omitir campo; unique por tenant vía índice partial.
   */
  @Prop()
  codigo?: string;

  /**
   * Imagen de producto (AD-23 / FR-60 / Story 8.1).
   * Solo runtime para `tipo=producto`; path relativo `/uploads/catalogo/...`.
   */
  @Prop()
  imagenUrl?: string;

  @Prop({ default: true })
  activo: boolean;
}

export const ServicioSchema = SchemaFactory.createForClass(Servicio);

ServicioSchema.index({ tenantId: 1, nombre: 1 });
ServicioSchema.index({ tenantId: 1, categoriaId: 1 });
ServicioSchema.index(
  { tenantId: 1, codigo: 1 },
  {
    unique: true,
    partialFilterExpression: { codigo: { $type: 'string', $gt: '' } },
  },
);
