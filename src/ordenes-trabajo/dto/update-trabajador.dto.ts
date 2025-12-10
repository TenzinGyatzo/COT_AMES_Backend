import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  Matches,
  MinLength,
} from 'class-validator';
import {
  sexos,
  nivelesEscolaridad,
  estadosCiviles,
} from '../schemas/trabajador.schema';

export class UpdateTrabajadorDto {
  @ApiPropertyOptional({
    description: 'Primer apellido del trabajador',
    example: 'García',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  primerApellido?: string;

  @ApiPropertyOptional({
    description: 'Segundo apellido del trabajador',
    example: 'López',
  })
  @IsOptional()
  @IsString()
  segundoApellido?: string;

  @ApiPropertyOptional({
    description: 'Nombre del trabajador',
    example: 'Juan',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Fecha de nacimiento del trabajador (ISO string)',
    example: '1990-01-15',
  })
  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @ApiPropertyOptional({
    description: 'Sexo del trabajador',
    enum: sexos,
    example: 'Masculino',
  })
  @IsOptional()
  @IsEnum(sexos)
  sexo?: string;

  @ApiPropertyOptional({
    description: 'Nivel de escolaridad del trabajador',
    enum: nivelesEscolaridad,
    example: 'Licenciatura',
  })
  @IsOptional()
  @IsEnum(nivelesEscolaridad)
  escolaridad?: string;

  @ApiPropertyOptional({
    description: 'Puesto del trabajador',
    example: 'Operador de máquina',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  puesto?: string;

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

  @ApiPropertyOptional({
    description: 'Estado civil del trabajador',
    enum: estadosCiviles,
    example: 'Casado/a',
  })
  @IsOptional()
  @IsEnum(estadosCiviles)
  estadoCivil?: string;

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

