import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
} from 'class-validator';
import { CreateServicioDto } from './create-servicio.dto';

/**
 * Story 4.4 — create-only multi-tenant (admin_sistema).
 * Excepción acotada a AD-2: `tenantIds` son destinos de creación, no el tenant efectivo de listados.
 */
export class CreateServicioMultiDto extends CreateServicioDto {
  @ApiProperty({
    description:
      'IDs de tenants activos destino (Querétaro y/o Los Mochis). 1 o 2, únicos.',
    type: [String],
    minItems: 1,
    maxItems: 2,
    example: ['507f1f77bcf86cd799439011'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsMongoId({ each: true })
  tenantIds: string[];
}
