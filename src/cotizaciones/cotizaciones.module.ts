import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CotizacionesService } from './cotizaciones.service';
import { CotizacionesController } from './cotizaciones.controller';
import { Cotizacion, CotizacionSchema } from './schemas/cotizacion.schema';
import { ClientesModule } from '../clientes/clientes.module';
import { ServiciosModule } from '../servicios/servicios.module';
import { EmailService } from './services/email.service';
import { EmailsModule } from '../emails/emails.module';
import { CountersModule } from '../counters/counters.module';
import { PlantillasModule } from '../plantillas/plantillas.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cotizacion.name, schema: CotizacionSchema },
    ]),
    forwardRef(() => ClientesModule),
    ServiciosModule,
    PlantillasModule,
    EmailsModule,
    CountersModule,
    UsersModule,
  ],
  controllers: [CotizacionesController],
  providers: [CotizacionesService, EmailService],
  exports: [CotizacionesService, EmailService],
})
export class CotizacionesModule {}
