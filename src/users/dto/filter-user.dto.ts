import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Roles } from '../../auth/enums/roles.enum';

export class FilterUserDto {
  @ApiPropertyOptional({
    description: 'Filtrar por activo (default: true si se omite)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ enum: Roles })
  @IsOptional()
  @IsEnum(Roles)
  rol?: string;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre o email' })
  @IsOptional()
  @IsString()
  search?: string;
}
