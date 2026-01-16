import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CotizacionesService } from './cotizaciones.service';
import { CotizacionesController } from './cotizaciones.controller';
import { Cotizacion, CotizacionSchema } from './schemas/cotizacion.schema';
import {
  OrdenTrabajo,
  OrdenTrabajoSchema,
} from '../ordenes-trabajo/schemas/orden-trabajo.schema';
import { ClientesModule } from '../clientes/clientes.module';
import { ServiciosModule } from '../servicios/servicios.module';
import { SedesModule } from '../sedes/sedes.module';
import { EmailService } from './services/email.service';
import { PdfService } from './services/pdf.service';
import { OrdenesTrabajoModule } from '../ordenes-trabajo/ordenes-trabajo.module';

import { EmailsModule } from '../emails/emails.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cotizacion.name, schema: CotizacionSchema },
      { name: OrdenTrabajo.name, schema: OrdenTrabajoSchema },
    ]),
    forwardRef(() => ClientesModule),
    ServiciosModule,
    SedesModule,
    EmailsModule,
    forwardRef(() => OrdenesTrabajoModule),
  ],
  controllers: [CotizacionesController],
  providers: [CotizacionesService, EmailService, PdfService],
  exports: [CotizacionesService, EmailService, PdfService],
})
export class CotizacionesModule {}
