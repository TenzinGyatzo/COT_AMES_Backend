import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TenantConfigDocument = TenantConfig & Document;

@Schema({ _id: false })
export class TenantBranding {
  /** Path público relativo, p.ej. `/uploads/tenant-logos/{tenantId}.png` */
  @Prop()
  logoUrl?: string;

  @Prop()
  razonSocial?: string;

  @Prop()
  rfc?: string;

  @Prop()
  domicilio?: string;

  @Prop()
  telefono?: string;

  @Prop()
  emailContacto?: string;

  @Prop()
  sitioWeb?: string;
}

export const TenantBrandingSchema = SchemaFactory.createForClass(TenantBranding);

@Schema({ _id: false })
export class TenantBancarios {
  @Prop()
  titular?: string;

  @Prop()
  banco?: string;

  @Prop()
  cuenta?: string;

  @Prop()
  clabe?: string;

  @Prop()
  domicilio?: string;

  @Prop()
  rfc?: string;

  @Prop()
  email?: string;
}

export const TenantBancariosSchema = SchemaFactory.createForClass(TenantBancarios);

/**
 * Configuración por tenant.
 * Branding: 2.2. Remitente/notificaciones: 2.3. Vigencia/bancarios: 2.4.
 */
@Schema({ timestamps: true, collection: 'tenant_configs' })
export class TenantConfig {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, unique: true })
  tenantId: Types.ObjectId;

  @Prop({ type: TenantBrandingSchema, default: () => ({}) })
  branding?: TenantBranding;

  /** From lógico de cotizaciones (≠ branding.emailContacto). */
  @Prop()
  emailRemitente?: string;

  /** Correos adicionales para notificaciones internas (FR-37/38 → Epic 6). */
  @Prop({ type: [String], default: [] })
  correosNotificacion?: string[];

  /** Días de vigencia default al crear cotización sin fecha explícita (1–365). */
  @Prop({ default: 30 })
  vigenciaDefaultDias?: number;

  /** Contenido de página bancaria PDF (toggle por cotización, no global). */
  @Prop({ type: TenantBancariosSchema, default: () => ({}) })
  bancarios?: TenantBancarios;
}

export const TenantConfigSchema = SchemaFactory.createForClass(TenantConfig);
