import { ApiProperty } from '@nestjs/swagger';

export class PaginatedCategoriasServicioResponseDto {
  @ApiProperty({ description: 'Lista de categorías', type: Array })
  data: unknown[];

  @ApiProperty({ example: 5 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 1 })
  totalPages: number;
}
