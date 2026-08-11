import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiciosService } from './servicios.service';
import { ServiciosController } from './servicios.controller';
import { CategoriasServicioService } from './categorias-servicio.service';
import { CategoriasServicioController } from './categorias-servicio.controller';
import { Servicio, ServicioSchema } from './schemas/servicio.schema';
import {
  CategoriaServicioEntity,
  CategoriaServicioSchema,
} from './schemas/categoria-servicio.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Servicio.name, schema: ServicioSchema },
      {
        name: CategoriaServicioEntity.name,
        schema: CategoriaServicioSchema,
      },
    ]),
  ],
  // Categorías antes de Servicios: evita que GET/PATCH/DELETE :id capture «categorias»
  controllers: [CategoriasServicioController, ServiciosController],
  providers: [ServiciosService, CategoriasServicioService],
  exports: [ServiciosService, CategoriasServicioService],
})
export class ServiciosModule {}
