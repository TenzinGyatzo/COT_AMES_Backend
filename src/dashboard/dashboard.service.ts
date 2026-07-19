import { Injectable } from '@nestjs/common';
import { ClientesService } from '../clientes/clientes.service';
import { ContactosService } from '../clientes/contactos.service';
import { ServiciosService } from '../servicios/servicios.service';
import { UsersService } from '../users/users.service';
import { TenantContextService } from '../tenants/tenant-context.service';
import { EntityTotalsDto } from './dto/entity-totals.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly contactosService: ContactosService,
    private readonly serviciosService: ServiciosService,
    private readonly usersService: UsersService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getEntityTotals(): Promise<EntityTotalsDto> {
    const tenantId = this.tenantContext.getTenantId();
    const [clientes, contactos, usuarios, servicios] = await Promise.all([
      this.clientesService.countActive(),
      this.contactosService.countActive(),
      this.usersService.countOperativosByTenant(tenantId),
      this.serviciosService.countActive(),
    ]);
    return { clientes, contactos, usuarios, servicios };
  }
}
