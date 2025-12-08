import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsEmail,
  IsArray,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateItemCotizacionClienteDto {
  @ApiProperty({
    description: 'ID del servicio',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  servicioId: string;

  @ApiProperty({
    description: 'Cantidad del servicio',
    example: 2,
    minimum: 1,
  })
  @Min(1)
  cantidad: number;
}

export class CreateCotizacionClienteDto {
  @ApiProperty({
    description: 'ID de la sede',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  sedeId: string;

  @ApiProperty({
    description: 'Correo electrónico de contacto',
    example: 'contacto@empresa.com',
  })
  @IsEmail()
  emailContacto: string;

  @ApiProperty({
    description: 'Items de la cotización',
    type: [CreateItemCotizacionClienteDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateItemCotizacionClienteDto)
  items: CreateItemCotizacionClienteDto[];
}
