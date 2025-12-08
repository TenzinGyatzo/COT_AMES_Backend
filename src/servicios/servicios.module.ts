import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiciosService } from './servicios.service';
import { ServiciosController } from './servicios.controller';
import { Servicio, ServicioSchema } from './schemas/servicio.schema';
import { SedesModule } from '../sedes/sedes.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Servicio.name, schema: ServicioSchema },
    ]),
    SedesModule,
  ],
  controllers: [ServiciosController],
  providers: [ServiciosService],
  exports: [ServiciosService],
})
export class ServiciosModule {}
