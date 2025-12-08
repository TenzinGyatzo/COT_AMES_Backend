import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import {
  Cotizacion,
  CotizacionSchema,
} from '../cotizaciones/schemas/cotizacion.schema';
import { Cliente, ClienteSchema } from '../clientes/schemas/cliente.schema';
import { Servicio, ServicioSchema } from '../servicios/schemas/servicio.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cotizacion.name, schema: CotizacionSchema },
      { name: Cliente.name, schema: ClienteSchema },
      { name: Servicio.name, schema: ServicioSchema },
    ]),
  ],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
