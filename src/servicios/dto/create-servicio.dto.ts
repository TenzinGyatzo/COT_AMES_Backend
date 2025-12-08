import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsMongoId,
  Min,
  IsBoolean,
} from 'class-validator';

export class CreateServicioDto {
  @ApiProperty({
    description: 'ID de la sede a la que pertenece el servicio',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  sedeId: string;

  @ApiProperty({
    description: 'Nombre del servicio médico',
    example: 'Consulta general',
  })
  @IsString()
  nombre: string;

  @ApiPropertyOptional({
    description: 'Descripción detallada del servicio',
    example: 'Consulta médica general con duración de 30 minutos',
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({
    description: 'Precio unitario del servicio',
    example: 500.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  precioUnitario: number;

  @ApiPropertyOptional({
    description: 'Moneda del precio',
    example: 'MXN',
    default: 'MXN',
  })
  @IsOptional()
  @IsString()
  moneda?: string;

  @ApiPropertyOptional({
    description: 'Indica si el servicio está activo',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
