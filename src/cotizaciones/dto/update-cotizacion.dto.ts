import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
} from 'class-validator';

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
}
