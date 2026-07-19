import { ApiProperty } from '@nestjs/swagger';

export class PaginatedContactosResponseDto {
  @ApiProperty({ description: 'Lista de contactos', type: Array })
  data: unknown[];

  @ApiProperty({ example: 12 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 1 })
  totalPages: number;
}
