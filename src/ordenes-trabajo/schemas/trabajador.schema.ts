import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const sexos = ['Masculino', 'Femenino'] as const;

export const nivelesEscolaridad = [
  'Primaria',
  'Secundaria',
  'Preparatoria',
  'Licenciatura',
  'Maestría',
  'Doctorado',
  'Nula',
] as const;

export const estadosCiviles = [
  'Soltero/a',
  'Casado/a',
  'Unión libre',
  'Separado/a',
  'Divorciado/a',
  'Viudo/a',
] as const;

@Schema({ _id: false })
export class Trabajador {
  @Prop({ required: true })
  primerApellido: string;

  @Prop({ required: false })
  segundoApellido?: string;

  @Prop({ required: true })
  nombre: string;

  @Prop({ required: true })
  fechaNacimiento: Date;

  @Prop({ required: true, enum: sexos })
  sexo: string;

  @Prop({ required: true, enum: nivelesEscolaridad })
  escolaridad: string;

  @Prop({ required: true })
  puesto: string;

  @Prop({ required: false })
  fechaIngreso?: Date;

  @Prop({
    required: false,
    match: /^$|^\+?[0-9]\d{3,14}$/,
  })
  telefono?: string;

  @Prop({ required: true, enum: estadosCiviles })
  estadoCivil: string;

  @Prop({
    required: false,
    match: /^$|^[A-Za-z0-9\s\-_.\/#]{4,30}$/,
  })
  curp?: string;
}

export const TrabajadorSchema = SchemaFactory.createForClass(Trabajador);

