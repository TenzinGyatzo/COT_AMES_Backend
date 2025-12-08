import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsBoolean,
} from 'class-validator';

export class CreateServicioGlobalDto {
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
    description:
      'Precio unitario por defecto del servicio (se aplicará a todas las sedes)',
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
    description:
      'Indica si el servicio está activo por defecto en todas las sedes',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
