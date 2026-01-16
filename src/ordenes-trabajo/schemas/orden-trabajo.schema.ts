import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Trabajador, TrabajadorSchema } from './trabajador.schema';

export type OrdenTrabajoDocument = OrdenTrabajo & Document;

@Schema({ timestamps: true })
export class OrdenTrabajo {
  @Prop({ required: true, unique: true, index: true })
  folio: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Cotizacion',
    required: true,
    unique: true,
  })
  cotizacionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: false })
  clienteId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'UsuarioCliente',
    required: false,
  })
  usuarioClienteId: Types.ObjectId;

  // Campos para clientes no registrados (guest)
  @Prop()
  nombreEmpresa?: string;

  @Prop()
  nombreContacto?: string;

  @Prop()
  emailContacto?: string;

  @Prop()
  telefonoContacto?: string;

  @Prop({ type: Types.ObjectId, ref: 'Sede', required: true })
  sedeId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['pendiente', 'en_proceso', 'completada', 'cancelada'],
    default: 'pendiente',
  })
  estado: string;

  @Prop({ required: true })
  fechaCreacion: Date;

  @Prop()
  fechaInicio?: Date;

  @Prop()
  fechaCompletacion?: Date;

  // Timestamps de cambios de estado
  @Prop()
  fechaEstadoPendiente?: Date;

  @Prop()
  fechaEstadoEnProceso?: Date;

  @Prop()
  fechaEstadoCompletada?: Date;

  @Prop()
  fechaEstadoCancelada?: Date;

  @Prop({
    type: [
      {
        texto: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  observaciones?: Array<{ texto: string; timestamp: Date }>;

  @Prop({
    type: [TrabajadorSchema],
    default: [],
  })
  trabajadores?: Trabajador[];
}

export const OrdenTrabajoSchema = SchemaFactory.createForClass(OrdenTrabajo);

// Índices compuestos para optimizar consultas
OrdenTrabajoSchema.index({ clienteId: 1, usuarioClienteId: 1 });
OrdenTrabajoSchema.index({ sedeId: 1, fechaCreacion: -1 });
OrdenTrabajoSchema.index({ estado: 1 });
OrdenTrabajoSchema.index({ fechaCreacion: 1 });
