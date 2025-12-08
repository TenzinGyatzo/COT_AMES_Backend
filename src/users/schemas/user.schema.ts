import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Roles } from '../../auth/enums/roles.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true })
  nombre: string;

  @Prop({ required: true, enum: Roles, default: Roles.ADMIN })
  rol: string;

  @Prop({ default: true })
  activo: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
