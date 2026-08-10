import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';
import { parseOptionalQueryBoolean } from '../../common/parse-optional-query-boolean';

export class UpdateTenantActivoDto {
  @ApiProperty({
    example: false,
    description:
      'Estado deseado (idempotente). false = suspender; true = reactivar.',
  })
  @Transform(parseOptionalQueryBoolean)
  @IsBoolean()
  activo: boolean;
}
