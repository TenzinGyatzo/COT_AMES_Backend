import { ApiProperty } from '@nestjs/swagger';
import { OrdenTrabajoListItemDto } from './orden-trabajo-list-item.dto';

export class PaginatedOrdenesTrabajoResponseDto {
  @ApiProperty({
    description: 'Lista de órdenes de trabajo',
    type: [OrdenTrabajoListItemDto],
  })
  data: OrdenTrabajoListItemDto[];

  @ApiProperty({
    description: 'Total de órdenes que coinciden con los filtros',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Número de página actual',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Número de elementos por página',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total de páginas',
    example: 10,
  })
  totalPages: number;
}
