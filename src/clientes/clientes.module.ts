import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { ClientePortalController } from './cliente-portal.controller';
import { Cliente, ClienteSchema } from './schemas/cliente.schema';
import {
  UsuarioCliente,
  UsuarioClienteSchema,
} from './schemas/usuario-cliente.schema';
import { SedesModule } from '../sedes/sedes.module';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cliente.name, schema: ClienteSchema },
      { name: UsuarioCliente.name, schema: UsuarioClienteSchema },
    ]),
    SedesModule,
    forwardRef(() => CotizacionesModule),
  ],
  controllers: [ClientesController, ClientePortalController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
