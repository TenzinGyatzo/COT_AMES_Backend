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
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateItemCotizacionAdminDto {
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
  @IsInt()
  @Min(1)
  cantidad: number;
}

export class CreateCotizacionAdminDto {
  @ApiProperty({
    description: 'ID de la sede',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  sedeId: string;

  @ApiProperty({
    description: 'Nombre de la empresa del cliente',
    example: 'Empresa ABC S.A. de C.V.',
  })
  @IsString()
  nombreEmpresa: string;

  @ApiProperty({
    description: 'Nombre del contacto',
    example: 'Juan Pérez',
  })
  @IsString()
  nombreContacto: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico del contacto',
    example: 'contacto@empresa.com',
  })
  @IsOptional()
  @IsEmail()
  emailContacto?: string;

  @ApiPropertyOptional({
    description: 'Teléfono del contacto',
    example: '+52 662 123 4567',
  })
  @IsOptional()
  @IsString()
  telefonoContacto?: string;

  @ApiPropertyOptional({
    description: 'Nombre(s) de las personas a evaluar',
    example: 'Juan Pérez, María López',
  })
  @IsOptional()
  @IsString()
  personasAEvaluar?: string;

  @ApiProperty({
    description: 'Items de la cotización',
    type: [CreateItemCotizacionAdminDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateItemCotizacionAdminDto)
  items: CreateItemCotizacionAdminDto[];

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

  @ApiPropertyOptional({
    description:
      'Indica si se debe enviar un correo electrónico con la cotización al cliente',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  enviarEmail?: boolean;
}
