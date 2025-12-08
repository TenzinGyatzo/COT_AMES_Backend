import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SedesService } from './sedes.service';
import { SedesController } from './sedes.controller';
import { Sede, SedeSchema } from './schemas/sede.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Sede.name, schema: SedeSchema }]),
  ],
  controllers: [SedesController],
  providers: [SedesService],
  exports: [SedesService],
})
export class SedesModule {}
