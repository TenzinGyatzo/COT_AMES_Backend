import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsMongoId,
  IsBoolean,
  ValidateIf,
} from 'class-validator';

export class CreateClienteDto {
  @ApiProperty({
    description: 'Nombre de la empresa del cliente',
    example: 'Empresa ABC S.A. de C.V.',
  })
  @IsString()
  empresa: string;

  @ApiProperty({
    description: 'RFC de la empresa',
    example: 'ABC123456789',
  })
  @IsString()
  rfc: string;

  @ApiPropertyOptional({
    description: 'ID de la sede principal asociada al cliente',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  sedeId?: string;

  @ApiPropertyOptional({
    description: 'Indica si el cliente está activo',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({
    description:
      'Clave única del cliente. Si no se proporciona, se generará automáticamente.',
    example: 'A1B2C3D4',
  })
  @IsOptional()
  @IsString()
  clave?: string;
}
