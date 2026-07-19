import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlantillaDocument = Plantilla & Document;

/** Story 5.1 / AD-6 — schemaVersion 1 */
export type SeccionPlantillaV1 =
  | {
      id: string;
      tipo: 'richtext';
      titulo?: string;
      /** text = plain/legacy; doc = TipTap JSON (Story 5.3, opcional) */
      cuerpo: { text: string; doc?: Record<string, unknown> };
    }
  | {
      id: string;
      tipo: 'tabla';
      titulo?: string;
      encabezados: string[];
      filas: string[][];
    };

@Schema({ timestamps: true, collection: 'plantillas' })
export class Plantilla {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nombre: string;

  /** Solo seeds; plantillas custom (5.2) pueden omitirlo */
  @Prop({ required: false, trim: true })
  claveSeed?: string;

  @Prop({ required: true, default: 1 })
  schemaVersion: number;

  @Prop({ type: [Object], required: true, default: [] })
  secciones: SeccionPlantillaV1[];

  @Prop({ default: true })
  activo: boolean;
}

export const PlantillaSchema = SchemaFactory.createForClass(Plantilla);

// Unique por tenant+claveSeed solo cuando claveSeed existe (seeds)
PlantillaSchema.index(
  { tenantId: 1, claveSeed: 1 },
  {
    unique: true,
    partialFilterExpression: { claveSeed: { $type: 'string' } },
  },
);

PlantillaSchema.index({ tenantId: 1, activo: 1 });
