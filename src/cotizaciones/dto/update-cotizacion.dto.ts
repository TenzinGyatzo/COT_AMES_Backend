import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCotizacionDto {
  @ApiPropertyOptional({
    description: 'Correo electrónico de contacto',
    example: 'nuevo@ejemplo.com',
  })
  @IsOptional()
  @IsEmail()
  emailContacto?: string;

  @ApiPropertyOptional({
    description: 'Estado de la cotización',
    enum: ['vigente', 'vencida'],
    example: 'vencida',
  })
  @IsOptional()
  @IsEnum(['vigente', 'vencida'])
  estado?: string;

  @ApiPropertyOptional({
    description: 'URL del PDF generado',
    example: 'https://ejemplo.com/cotizaciones/123.pdf',
  })
  @IsOptional()
  @IsString()
  pdfUrl?: string;

  @ApiPropertyOptional({
    description: 'Fecha de vencimiento (ISO string)',
    example: '2024-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @ApiPropertyOptional({
    description: 'Fecha cuando se marcó como vigente',
    example: '2024-01-15T10:00:00.000Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fechaEstadoVigente?: Date;

  @ApiPropertyOptional({
    description: 'Fecha cuando se marcó como vencida',
    example: '2024-01-20T10:00:00.000Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fechaEstadoVencida?: Date;

  @ApiPropertyOptional({
    description: 'Fecha cuando se marcó como aceptada',
    example: '2024-01-25T10:00:00.000Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fechaEstadoAceptada?: Date;
}
