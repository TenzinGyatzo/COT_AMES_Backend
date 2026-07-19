import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantsModule } from '../tenants/tenants.module';
import { Plantilla, PlantillaSchema } from './schemas/plantilla.schema';
import { PlantillasService } from './plantillas.service';
import { PlantillasController } from './plantillas.controller';

@Module({
  imports: [
    TenantsModule,
    MongooseModule.forFeature([
      { name: Plantilla.name, schema: PlantillaSchema },
    ]),
  ],
  controllers: [PlantillasController],
  providers: [PlantillasService],
  exports: [PlantillasService],
})
export class PlantillasModule {}
