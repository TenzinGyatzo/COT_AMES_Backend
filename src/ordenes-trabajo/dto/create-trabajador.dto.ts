import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import {
  sexos,
  nivelesEscolaridad,
  estadosCiviles,
} from '../schemas/trabajador.schema';

export class CreateTrabajadorDto {
  @ApiProperty({
    description: 'Primer apellido del trabajador',
    example: 'García',
  })
  @IsString()
  @MinLength(1)
  primerApellido: string;

  @ApiPropertyOptional({
    description: 'Segundo apellido del trabajador',
    example: 'López',
  })
  @IsOptional()
  @IsString()
  segundoApellido?: string;

  @ApiProperty({
    description: 'Nombre del trabajador',
    example: 'Juan',
  })
  @IsString()
  @MinLength(1)
  nombre: string;

  @ApiProperty({
    description: 'Fecha de nacimiento del trabajador (ISO string)',
    example: '1990-01-15',
  })
  @IsDateString()
  fechaNacimiento: string;

  @ApiProperty({
    description: 'Sexo del trabajador',
    enum: sexos,
    example: 'Masculino',
  })
  @IsEnum(sexos)
  sexo: string;

  @ApiProperty({
    description: 'Nivel de escolaridad del trabajador',
    enum: nivelesEscolaridad,
    example: 'Licenciatura',
  })
  @IsEnum(nivelesEscolaridad)
  escolaridad: string;

  @ApiProperty({
    description: 'Puesto del trabajador',
    example: 'Operador de máquina',
  })
  @IsString()
  @MinLength(1)
  puesto: string;

  @ApiPropertyOptional({
    description: 'Fecha de ingreso del trabajador (ISO string)',
    example: '2020-03-01',
  })
  @IsOptional()
  @IsDateString()
  fechaIngreso?: string;

  @ApiPropertyOptional({
    description: 'Teléfono del trabajador',
    example: '+526641234567',
  })
  @IsOptional()
  @IsString()
  @Matches(/^$|^\+?[0-9]\d{3,14}$/, {
    message: 'El teléfono debe tener un formato válido',
  })
  telefono?: string;

  @ApiProperty({
    description: 'Estado civil del trabajador',
    enum: estadosCiviles,
    example: 'Casado/a',
  })
  @IsEnum(estadosCiviles)
  estadoCivil: string;

  @ApiPropertyOptional({
    description: 'CURP del trabajador',
    example: 'GALJ900115HDFRZN01',
  })
  @IsOptional()
  @IsString()
  @Matches(/^$|^[A-Za-z0-9\s\-_.\/#]{4,30}$/, {
    message: 'El CURP debe tener un formato válido',
  })
  curp?: string;
}

