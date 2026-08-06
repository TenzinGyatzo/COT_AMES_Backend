import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateNotaInternaDto {
  @ApiProperty({
    description: 'Texto de la nota interna (solo visible para usuarios AMES)',
    example: 'Cliente pidió revisar precios la próxima semana.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  texto: string;
}
