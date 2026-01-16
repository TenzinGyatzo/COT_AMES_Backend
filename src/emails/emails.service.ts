import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transporter } from 'nodemailer';
import { createTransporter } from './emails.config';
import { passwordResetTemplate } from './templates/password-reset.template';
import {
  cotizacionAceptadaTemplate,
  CotizacionAceptadaData,
} from './templates/cotizacion-aceptada.template';

@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name);
  private transporter: Transporter;
  private emailFrom: string;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('EMAIL_HOST');
    const port = this.configService.get<number>('EMAIL_PORT');
    const user = this.configService.get<string>('EMAIL_USER');
    const pass = this.configService.get<string>('EMAIL_PASS');
    this.emailFrom = this.configService.get<string>('EMAIL_FROM') || user;

    if (!host || !port || !user || !pass) {
      this.logger.warn(
        'Email configuration is incomplete. Email sending will fail.',
      );
    } else {
      this.transporter = createTransporter(host, port, user, pass);
      this.logger.log('Email transporter initialized successfully');
    }
  }

  /**
   * Método privado para enviar emails
   */
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    bcc?: string,
    attachments?: any[],
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    try {
      const mailOptions = {
        from: this.emailFrom,
        to,
        subject,
        html,
        ...(bcc && { bcc }),
        ...(attachments && { attachments }),
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Envía email con la cotización adjunta
   */
  async sendAdminQuotationEmail(
    email: string,
    nombreContacto: string,
    folio: string,
    pdfBuffer: Buffer,
    magicToken?: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const magicLink = magicToken 
      ? `${frontendUrl}/cotizacion-publica/${magicToken}`
      : null;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
        <h2 style="color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">Hola, ${nombreContacto}</h2>
        <p>Adjunto a este correo encontrarás la cotización <strong>${folio}</strong> que solicitaste a <strong>Médica Ocupacional Caborca</strong>.</p>
        
        ${magicLink ? `
          <div style="margin: 30px 0; text-align: center;">
            <p style="margin-bottom: 15px; color: #4b5563;">Puedes ver los detalles y responder a esta cotización directamente haciendo clic en el siguiente botón:</p>
            <a href="${magicLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Responder Cotización</a>
            <p style="margin-top: 10px; font-size: 12px; color: #9ca3af;">Este enlace tiene una vigencia de 30 días.</p>
          </div>
        ` : ''}

        <p>Quedamos a tu disposición para cualquier duda o comentario.</p>
        <br>
        <div style="color: #6b7280; font-size: 14px;">
          <p>Atentamente,<br>
          <strong>Equipo de Ventas</strong><br>
          Médica Ocupacional Caborca</p>
        </div>
      </div>
    `;

    await this.sendEmail(
      email,
      `Cotización ${folio} - Médica Ocupacional Caborca`,
      html,
      this.emailFrom, // BCC para copia
      [
        {
          filename: `Cotizacion_${folio}.pdf`,
          content: pdfBuffer,
        },
      ],
    );
  }

  /**
   * Envía email de restablecimiento de contraseña
   */
  async sendPasswordResetEmail(
    email: string,
    nombre: string,
    token: string,
    tipoUsuario: 'admin' | 'cliente',
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetPath =
      tipoUsuario === 'admin' ? '/reset-password' : '/cliente/reset-password';
    const resetUrl = `${frontendUrl}${resetPath}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    const html = passwordResetTemplate(nombre, resetUrl, tipoUsuario);

    await this.sendEmail(
      email,
      'Restablecer Contraseña - Cotizador',
      html,
      this.emailFrom, // BCC para copia
    );
  }

  /**
   * Envía email cuando se acepta cotización y se genera orden de trabajo
   */
  async sendCotizacionAceptadaYOrdenEmail(
    data: CotizacionAceptadaData,
    emailDestino: string,
  ): Promise<void> {
    const html = cotizacionAceptadaTemplate(data);

    await this.sendEmail(
      emailDestino,
      `Cotización ${data.folioCotizacion} Aceptada - Orden ${data.folioOrdenTrabajo} Generada`,
      html,
      this.emailFrom, // BCC para copia
    );
  }
}
