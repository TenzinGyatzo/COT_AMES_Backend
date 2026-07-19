import { Injectable, Logger } from '@nestjs/common';
import { EmailsService } from '../../emails/emails.service';

export type QuotationEmailExtras = {
  emisorNombre?: string;
  fechaVencimiento?: Date;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly emailsService: EmailsService) {}

  async sendAdminQuotationEmail(
    email: string | string[],
    nombreContacto: string,
    folio: string,
    pdfBuffer: Buffer,
    magicToken?: string,
    fromOverride?: string,
    cc?: string[],
    extras?: QuotationEmailExtras,
  ): Promise<void> {
    try {
      await this.emailsService.sendAdminQuotationEmail(
        email,
        nombreContacto,
        folio,
        pdfBuffer,
        magicToken,
        fromOverride,
        cc,
        extras,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error al enviar email de cotización admin: ${msg}`);
      throw error;
    }
  }

  async sendQuotationEmail(
    cotizacionId: string,
    correoDestino: string,
    folio: string,
  ): Promise<void> {
    this.logger.log(
      `Stub: sendQuotationMail (deprecado, usar sendAdminQuotationEmail con buffer) para ${folio}`,
    );
  }

  /** Story 6.13 — aviso interno post magic-link (propaga error; el caller swallow). */
  async sendInternalDecisionNotification(params: {
    to: string[];
    folio: string;
    decision: 'aceptada' | 'rechazada';
    solicitanteLabel: string;
    fromOverride?: string;
  }): Promise<void> {
    await this.emailsService.sendInternalDecisionNotification(params);
  }
}
