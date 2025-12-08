import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { EstadoMexico } from '../enums/estado-mexico.enum';

export class CreateSedeDto {
  @ApiPropertyOptional({
    description: 'Clave corta de la sede para identificadores internos',
    example: 'CAB',
  })
  @IsOptional()
  @IsString()
  clave?: string;

  @ApiProperty({
    description: 'Ciudad donde se encuentra la sede',
    example: 'Caborca',
  })
  @IsString()
  ciudad: string;

  @ApiPropertyOptional({
    description: 'Estado donde se encuentra la sede',
    enum: EstadoMexico,
    example: EstadoMexico.SONORA,
  })
  @IsOptional()
  @IsEnum(EstadoMexico)
  estado?: EstadoMexico;

  @ApiPropertyOptional({
    description: 'Indica si la sede está activa',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
