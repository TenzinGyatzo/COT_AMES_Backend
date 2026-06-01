import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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

@Schema({ timestamps: true })
export class Cotizacion {
  @Prop({ required: true, unique: true, index: true })
  folio: string;

  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: false })
  clienteId?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'UsuarioCliente',
    required: false,
    index: true,
  })
  usuarioClienteId?: Types.ObjectId;

  // Campos para cotizaciones de clientes no registrados (guest quotations)
  @Prop()
  nombreEmpresa?: string;

  @Prop()
  nombreContacto?: string;

  @Prop()
  telefonoContacto?: string;

  @Prop()
  personasAEvaluar?: string;

  @Prop({ type: Types.ObjectId, ref: 'Sede', required: true })
  sedeId: Types.ObjectId;

  @Prop({ required: false })
  emailContacto?: string;

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

  // Timestamps de cambios de estado
  @Prop()
  fechaEstadoVigente?: Date;

  @Prop()
  fechaEstadoVencida?: Date;

  @Prop()
  fechaEstadoAceptada?: Date;

  @Prop()
  fechaEstadoRechazada?: Date;

  @Prop({ type: Types.ObjectId, ref: 'OrdenTrabajo' })
  ordenTrabajoId?: Types.ObjectId;

  @Prop()
  pdfUrl?: string;

  @Prop({ index: true, unique: true, sparse: true })
  magicToken?: string;

  @Prop()
  magicTokenExpiresAt?: Date;

  @Prop({ default: false })
  incluirDatosBancarios?: boolean;
}

export const CotizacionSchema = SchemaFactory.createForClass(Cotizacion);

// Índices para optimizar consultas de métricas e historial
CotizacionSchema.index({ clienteId: 1 });
CotizacionSchema.index({ usuarioClienteId: 1 });
CotizacionSchema.index({ sedeId: 1 });
CotizacionSchema.index({ estado: 1 });
CotizacionSchema.index({ fechaCreacion: 1 });
CotizacionSchema.index({ fechaVencimiento: 1 });
CotizacionSchema.index({ 'items.servicioId': 1 });
// Índice compuesto para consultas comunes
CotizacionSchema.index({ estado: 1, fechaVencimiento: 1 });
CotizacionSchema.index({ sedeId: 1, estado: 1 });
CotizacionSchema.index({ clienteId: 1, usuarioClienteId: 1 });
CotizacionSchema.index({ magicToken: 1 }, { unique: true, sparse: true });
