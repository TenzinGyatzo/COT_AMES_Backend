import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendQuotationEmail(
    cotizacionId: string,
    correoDestino: string,
    folio: string,
  ): Promise<void> {
    // TODO: implementar en fase posterior
    this.logger.log(
      `Stub: Enviaría correo de cotización ${folio} a ${correoDestino}`,
    );
    return;
  }
}
