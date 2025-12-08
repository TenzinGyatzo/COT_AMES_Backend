import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail } from 'class-validator';

export class FilterClienteDto {
  @ApiPropertyOptional({
    description: 'Filtrar por nombre de empresa',
    example: 'Empresa ABC',
  })
  @IsOptional()
  @IsString()
  empresa?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por RFC',
    example: 'ABC123456789',
  })
  @IsOptional()
  @IsString()
  rfc?: string;
}
