import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNumber, Min } from 'class-validator';

export class CreateItemCotizacionDto {
  @ApiProperty({
    description: 'ID del servicio a cotizar',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  servicioId: string;

  @ApiProperty({
    description: 'Cantidad del servicio',
    example: 2,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  cantidad: number;
}
