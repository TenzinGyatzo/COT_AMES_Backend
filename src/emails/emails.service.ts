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
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
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
