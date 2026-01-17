import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { SedesModule } from './sedes/sedes.module';
import { ServiciosModule } from './servicios/servicios.module';
import { ClientesModule } from './clientes/clientes.module';
import { CotizacionesModule } from './cotizaciones/cotizaciones.module';
import { OrdenesTrabajoModule } from './ordenes-trabajo/ordenes-trabajo.module';
import { MetricsModule } from './metrics/metrics.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { EmailsModule } from './emails/emails.module';
import { ScheduleModule } from '@nestjs/schedule'; // Import ScheduleModule
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    UsersModule,
    AuthModule,
    EmailsModule,
    SedesModule,
    ServiciosModule,
    ClientesModule,
    CotizacionesModule,
    OrdenesTrabajoModule,
    MetricsModule,
    WhatsappModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
