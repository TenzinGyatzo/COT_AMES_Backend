import { Injectable, Logger } from '@nestjs/common';
import { EmailsService } from '../../emails/emails.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly emailsService: EmailsService) {}

  async sendAdminQuotationEmail(
    email: string,
    nombreContacto: string,
    folio: string,
    pdfBuffer: Buffer,
    magicToken?: string,
  ): Promise<void> {
    try {
      await this.emailsService.sendAdminQuotationEmail(
        email,
        nombreContacto,
        folio,
        pdfBuffer,
        magicToken,
      );
    } catch (error) {
      this.logger.error(`Error al enviar email de cotización admin: ${error.message}`);
      throw error;
    }
  }

  async sendQuotationEmail(
    cotizacionId: string,
    correoDestino: string,
    folio: string,
  ): Promise<void> {
    // Mantener para compatibilidad, aunque ahora preferimos sendAdminQuotationEmail con buffer
    this.logger.log(
      `Stub: sendQuotationMail (deprecado, usar sendAdminQuotationEmail con buffer) para ${folio}`,
    );
  }
}
