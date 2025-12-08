import { ApiProperty } from '@nestjs/swagger';
import { CotizacionListItemDto } from './cotizacion-list-item.dto';

export class PaginatedCotizacionesResponseDto {
  @ApiProperty({
    description: 'Lista de cotizaciones',
    type: [CotizacionListItemDto],
  })
  data: CotizacionListItemDto[];

  @ApiProperty({
    description: 'Total de cotizaciones que coinciden con los filtros',
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
