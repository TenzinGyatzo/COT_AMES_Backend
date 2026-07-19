import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ClientesModule } from '../clientes/clientes.module';
import { ServiciosModule } from '../servicios/servicios.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ClientesModule, ServiciosModule, UsersModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
