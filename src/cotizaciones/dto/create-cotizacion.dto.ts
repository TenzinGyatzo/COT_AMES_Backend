import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMongoId,
  IsEmail,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateItemCotizacionDto } from './create-item-cotizacion.dto';

export class CreateCotizacionDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  clienteId: string;

  @ApiProperty({
    description: 'Correo electrónico de contacto para la cotización',
    example: 'cliente@ejemplo.com',
  })
  @IsEmail()
  emailContacto: string;

  @ApiProperty({
    description: 'Lista de items de la cotización',
    type: [CreateItemCotizacionDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateItemCotizacionDto)
  items: CreateItemCotizacionDto[];

  @ApiPropertyOptional({
    description: 'Moneda de la cotización',
    example: 'MXN',
    default: 'MXN',
  })
  @IsOptional()
  @IsString()
  moneda?: string;

  @ApiPropertyOptional({
    description: 'Fecha de vencimiento de la cotización (ISO string)',
    example: '2024-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;
}
