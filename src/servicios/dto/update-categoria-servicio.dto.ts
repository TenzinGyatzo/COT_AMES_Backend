import { PartialType } from '@nestjs/swagger';
import { CreateCategoriaServicioDto } from './create-categoria-servicio.dto';

export class UpdateCategoriaServicioDto extends PartialType(
  CreateCategoriaServicioDto,
) {}
