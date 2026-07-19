import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import type { SeccionPlantillaV1 } from '../../plantillas/schemas/plantilla.schema';

export type CotizacionDocument = Cotizacion & Document;

export class ItemCotizacion {
  @Prop({ type: Types.ObjectId, ref: 'Servicio', required: true })
  servicioId: Types.ObjectId;

  @Prop({ required: true })
  nombreServicioSnapshot: string;

  @Prop()
  descripcionServicioSnapshot?: string;

  @Prop({ required: true, min: 0 })
  precioUnitarioSnapshot: number;

  @Prop({ required: true, min: 1 })
  cantidad: number;

  @Prop({ required: true, min: 0 })
  subtotal: number;
}

/** Snapshot de plantilla embebido (Story 6.5 / AD-6). Orden del array = orden PDF tras cuerpo. */
export class PlantillaSnapshot {
  @Prop({ type: Types.ObjectId, ref: 'Plantilla', required: true })
  plantillaId: Types.ObjectId;

  @Prop({ required: true })
  nombreSnapshot: string;

  @Prop({ required: true, default: 1 })
  schemaVersion: number;

  @Prop({ type: [Object], required: true, default: [] })
  secciones: SeccionPlantillaV1[];
}

@Schema({ timestamps: true })
export class Cotizacion {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ required: true, index: true })
  folio: string;

  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: false })
  clienteId?: Types.ObjectId;

  @Prop()
  nombreEmpresa?: string;

  @Prop()
  nombreContacto?: string;

  @Prop()
  telefonoContacto?: string;

  @Prop()
  personasAEvaluar?: string;

  @Prop({ required: false })
  emailContacto?: string;

  /** Destinatarios Para (Story 6.6). Orden = chips. */
  @Prop({ type: [String], default: [] })
  emailsPara?: string[];

  /** Destinatarios CC (Story 6.6). Orden = chips. */
  @Prop({ type: [String], default: [] })
  emailsCc?: string[];

  @Prop({ type: [Object], required: true })
  items: ItemCotizacion[];

  @Prop({ required: true, min: 0 })
  total: number;

  @Prop({ default: 'MXN' })
  moneda: string;

  @Prop({ required: true })
  fechaCreacion: Date;

  @Prop({ required: true })
  fechaVencimiento: Date;

  @Prop({
    type: String,
    enum: ['vigente', 'vencida', 'aceptada', 'rechazada'],
    default: 'vigente',
  })
  estado: string;

  @Prop()
  fechaAceptacion?: Date;

  @Prop()
  fechaRechazo?: Date;

  @Prop()
  fechaEstadoVigente?: Date;

  @Prop()
  fechaEstadoVencida?: Date;

  @Prop()
  fechaEstadoAceptada?: Date;

  @Prop()
  fechaEstadoRechazada?: Date;

  @Prop()
  pdfUrl?: string;

  @Prop({ index: true, unique: true, sparse: true })
  magicToken?: string;

  @Prop()
  magicTokenExpiresAt?: Date;

  /**
   * Origen del último cambio de estado (Story 6.9 write / 6.10 UI).
   * magic_link | usuario | cron
   */
  @Prop({
    type: String,
    enum: ['magic_link', 'usuario', 'cron'],
    required: false,
  })
  estadoOrigen?: string;

  @Prop()
  estadoOrigenAt?: Date;

  /** Actor AMES del último cambio manual (Story 6.10). Ausente en magic_link/cron. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  estadoCambiadoPorUserId?: Types.ObjectId;

  /** Snapshot de nombre al momento del cambio (microcopy “Marcado por {nombre}”). */
  @Prop({ required: false })
  estadoCambiadoPorNombre?: string;

  /** Usuario AMES que creó la cotización (create/repetir). Story 6.13 / FR-37. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  creadoPorUserId?: Types.ObjectId;

  /** Snapshot de email del creador al momento del alta (notif interna si el user cambia). */
  @Prop({ required: false })
  creadoPorEmail?: string;

  @Prop({ default: false })
  incluirDatosBancarios?: boolean;

  /** Plantillas aplicadas (deep copy). Vacío/omitido = sin páginas de plantilla. */
  @Prop({ type: [Object], default: [] })
  plantillasSnapshot?: PlantillaSnapshot[];
}

export const CotizacionSchema = SchemaFactory.createForClass(Cotizacion);

CotizacionSchema.index({ tenantId: 1, folio: 1 }, { unique: true });
CotizacionSchema.index({ tenantId: 1, fechaCreacion: -1 });
CotizacionSchema.index({ tenantId: 1, estado: 1 });
CotizacionSchema.index({ clienteId: 1 });
CotizacionSchema.index({ estado: 1 });
CotizacionSchema.index({ fechaCreacion: 1 });
CotizacionSchema.index({ fechaVencimiento: 1 });
CotizacionSchema.index({ 'items.servicioId': 1 });
CotizacionSchema.index({ estado: 1, fechaVencimiento: 1 });
CotizacionSchema.index({ magicToken: 1 }, { unique: true, sparse: true });
