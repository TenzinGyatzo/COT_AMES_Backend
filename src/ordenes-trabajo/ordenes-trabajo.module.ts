import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdenesTrabajoService } from './ordenes-trabajo.service';
import { OrdenesTrabajoController } from './ordenes-trabajo.controller';
import { ClientePortalOrdenesController } from './cliente-portal-ordenes.controller';
import {
  OrdenTrabajo,
  OrdenTrabajoSchema,
} from './schemas/orden-trabajo.schema';
import {
  Cotizacion,
  CotizacionSchema,
} from '../cotizaciones/schemas/cotizacion.schema';
import { ClientesModule } from '../clientes/clientes.module';
import { SedesModule } from '../sedes/sedes.module';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrdenTrabajo.name, schema: OrdenTrabajoSchema },
      { name: Cotizacion.name, schema: CotizacionSchema },
    ]),
    forwardRef(() => ClientesModule),
    SedesModule,
    forwardRef(() => CotizacionesModule),
  ],
  controllers: [OrdenesTrabajoController, ClientePortalOrdenesController],
  providers: [OrdenesTrabajoService],
  exports: [OrdenesTrabajoService],
})
export class OrdenesTrabajoModule {}
