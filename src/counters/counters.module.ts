import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Counter, CounterSchema } from './schemas/counter.schema';
import {
  Cotizacion,
  CotizacionSchema,
} from '../cotizaciones/schemas/cotizacion.schema';
import { CountersService } from './counters.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Counter.name, schema: CounterSchema },
      // Lectura brownfield para bootstrap de seq (AD-9 / Story 6.1)
      { name: Cotizacion.name, schema: CotizacionSchema },
    ]),
  ],
  providers: [CountersService],
  exports: [CountersService],
})
export class CountersModule {}
