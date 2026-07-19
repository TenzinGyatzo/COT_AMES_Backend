import { ApiProperty } from '@nestjs/swagger';

export class PaginatedPlantillasResponseDto {
  @ApiProperty({ description: 'Lista de plantillas', type: Array })
  data: unknown[];

  @ApiProperty({ example: 4 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 1 })
  totalPages: number;
}
