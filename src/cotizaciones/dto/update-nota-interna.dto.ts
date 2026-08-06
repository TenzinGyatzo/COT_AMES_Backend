import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateNotaInternaDto {
  @ApiProperty({
    description: 'Texto actualizado de la nota interna',
    example: 'Cliente confirmó que revisará precios el lunes.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  texto: string;
}
