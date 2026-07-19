import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PasswordResetTokenDocument = PasswordResetToken & Document;

@Schema({ timestamps: true })
export class PasswordResetToken {
  @Prop({ required: true, index: true })
  email: string;

  @Prop({ required: true })
  tokenHash: string;

  /** Discriminator de tokens AMES (legacy string; no es rol JWT). */
  @Prop({ required: true, enum: ['admin'] })
  userType: string;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop()
  usedAt?: Date;
}

export const PasswordResetTokenSchema =
  SchemaFactory.createForClass(PasswordResetToken);

// Index para auto-eliminar tokens expirados (TTL index)
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
