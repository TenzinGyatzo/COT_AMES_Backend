import { ApiProperty } from '@nestjs/swagger';

/** Totales CRM del tenant en contexto (Story 7.3). */
export class EntityTotalsDto {
  @ApiProperty({ description: 'Clientes activos del tenant' })
  clientes: number;

  @ApiProperty({ description: 'Contactos activos del tenant' })
  contactos: number;

  @ApiProperty({
    description: 'Usuarios operativos activos del tenant (sin admin_sistema)',
  })
  usuarios: number;

  @ApiProperty({ description: 'Servicios activos del tenant' })
  servicios: number;
}
