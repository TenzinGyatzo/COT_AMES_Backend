import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTrabajadorDto } from '../../ordenes-trabajo/dto/create-trabajador.dto';

export class AceptarCotizacionDto {
  @ApiProperty({
    description: 'Lista de trabajadores para la orden de trabajo',
    type: [CreateTrabajadorDto],
    example: [
      {
        primerApellido: 'García',
        segundoApellido: 'López',
        nombre: 'Juan',
        fechaNacimiento: '1990-01-15',
        sexo: 'Masculino',
        escolaridad: 'Licenciatura',
        puesto: 'Operador',
        fechaIngreso: '2020-03-01',
        telefono: '+526641234567',
        estadoCivil: 'Casado/a',
        curp: 'GALJ900115HDFRZN01',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Debe agregar al menos un trabajador',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateTrabajadorDto)
  trabajadores: CreateTrabajadorDto[];
}
