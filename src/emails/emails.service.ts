import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transporter } from 'nodemailer';
import { isEmail } from 'class-validator';
import { createTransporter } from './emails.config';
import { passwordResetTemplate } from './templates/password-reset.template';
import { quotationDecisionNotificationTemplate } from './templates/quotation-decision-notification.template';

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
   * @param fromOverride Remitente tenant (Story 2.3); fallback EMAIL_FROM
   * @param cc Destinatarios CC opcionales (Story 6.6 puente)
   */
  private async sendEmail(
    to: string | string[],
    subject: string,
    html: string,
    bcc?: string,
    attachments?: any[],
    fromOverride?: string,
    cc?: string | string[],
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    try {
      const mailOptions = {
        from: fromOverride?.trim() || this.emailFrom,
        to,
        subject,
        html,
        ...(bcc && { bcc }),
        ...(cc && (Array.isArray(cc) ? cc.length > 0 : !!cc) && { cc }),
        ...(attachments && { attachments }),
      };

      const info = await this.transporter.sendMail(mailOptions);
      const toLog = Array.isArray(to) ? to.join(', ') : to;
      this.logger.log(`Email sent to ${toLog}: ${info.messageId}`);
    } catch (error) {
      const toLog = Array.isArray(to) ? to.join(', ') : to;
      this.logger.error(`Failed to send email to ${toLog}:`, error);
      throw error;
    }
  }

  /**
   * Envía email con la cotización adjunta
   * @param fromOverride Remitente del tenant (emailRemitente); si falta → EMAIL_FROM
   * @param cc Destinatarios CC (Story 6.6)
   * @param extras Branding/vigencia (Story 6.8)
   */
  async sendAdminQuotationEmail(
    email: string | string[],
    nombreContacto: string,
    folio: string,
    pdfBuffer: Buffer,
    magicToken?: string,
    fromOverride?: string,
    cc?: string[],
    extras?: { emisorNombre?: string; fechaVencimiento?: Date },
  ): Promise<void> {
    let magicLink: string | null = null;
    if (magicToken) {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL')?.trim();
      if (!frontendUrl) {
        this.logger.error(
          'FRONTEND_URL is not configured; cannot build magic link for quotation email',
        );
        throw new Error('FRONTEND_URL is not configured');
      }
      const base = frontendUrl.replace(/\/+$/, '');
      magicLink = `${base}/cotizacion-publica/${encodeURIComponent(magicToken)}`;
    }

    const safeNombre = this.escapeHtml(nombreContacto || 'Cliente');
    const safeFolio = this.escapeHtml(folio || '');
    const emisor =
      this.escapeHtml(extras?.emisorNombre?.trim() || '') || 'AMES';
    const vigenciaLabel = extras?.fechaVencimiento
      ? this.formatVigencia(extras.fechaVencimiento)
      : null;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
        <h2 style="color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">Hola, ${safeNombre}</h2>
        <p>Adjunto a este correo encontrarás la cotización <strong>${safeFolio}</strong> que solicitaste a <strong>${emisor}</strong>.</p>
        
        ${
          magicLink
            ? `
          <div style="margin: 30px 0; text-align: center;">
            <p style="margin-bottom: 15px; color: #4b5563;">Puedes ver los detalles y responder a esta cotización directamente haciendo clic en el siguiente botón:</p>
            <a href="${this.escapeHtml(magicLink)}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Responder Cotización</a>
            ${
              vigenciaLabel
                ? `<p style="margin-top: 10px; font-size: 12px; color: #9ca3af;">Este enlace es válido hasta el ${this.escapeHtml(vigenciaLabel)}.</p>`
                : ''
            }
          </div>
        `
            : ''
        }

        <p>Quedamos a tu disposición para cualquier duda o comentario.</p>
        <br>
        <div style="color: #6b7280; font-size: 14px;">
          <p>Atentamente,<br>
          <strong>Equipo de Ventas</strong><br>
          ${emisor}</p>
        </div>
      </div>
    `;

    const from = fromOverride?.trim() || this.emailFrom;
    await this.sendEmail(
      email,
      `Cotización ${folio} - ${extras?.emisorNombre?.trim() || 'AMES'}`,
      html,
      this.emailFrom, // BCC copia global (≠ correosNotificacion FR-40)
      [
        {
          filename: `Cotizacion_${folio}.pdf`,
          content: pdfBuffer,
        },
      ],
      from,
      cc?.length ? cc : undefined,
    );
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private formatVigencia(date: Date): string {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    try {
      return d.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  }

  /**
   * Notificación interna accept/reject vía magic link (Story 6.13 / FR-37/38).
   * Sin PDF ni magic link al cliente. Sin BCC EMAIL_FROM (≠ correosNotificacion).
   */
  async sendInternalDecisionNotification(params: {
    to: string[];
    folio: string;
    decision: 'aceptada' | 'rechazada';
    solicitanteLabel: string;
    fromOverride?: string;
  }): Promise<void> {
    const to = (params.to || [])
      .map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
      .filter((e) => e && isEmail(e));
    if (to.length === 0) {
      throw new Error('sendInternalDecisionNotification requiere al menos un destinatario');
    }
    const safeFolio = this.escapeHtml(params.folio || '');
    const decisionLabel =
      params.decision === 'aceptada' ? 'aceptada' : 'rechazada';
    const safeDecision = this.escapeHtml(decisionLabel);
    const safeSolicitante = this.escapeHtml(
      params.solicitanteLabel?.trim() || 'Sin solicitante',
    );
    const html = quotationDecisionNotificationTemplate({
      folio: safeFolio,
      decisionLabel: safeDecision,
      solicitanteLabel: safeSolicitante,
    });
    const from = params.fromOverride?.trim() || this.emailFrom;
    const subjectFolio = String(params.folio || '')
      .replace(/[\r\n\x00-\x1f\x7f]+/g, ' ')
      .trim()
      .slice(0, 120);
    await this.sendEmail(
      to,
      `Cotización ${subjectFolio} ${decisionLabel}`,
      html,
      undefined,
      undefined,
      from,
    );
  }

  /**
   * Envía email de restablecimiento de contraseña
   */
  async sendPasswordResetEmail(
    email: string,
    nombre: string,
    token: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL')?.trim();
    if (!frontendUrl) {
      this.logger.error(
        'FRONTEND_URL is not configured; cannot send password reset email',
      );
      throw new Error('FRONTEND_URL is not configured');
    }

    const base = frontendUrl.replace(/\/+$/, '');
    const resetUrl = `${base}/admin/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    const html = passwordResetTemplate(nombre, resetUrl);

    await this.sendEmail(
      email,
      'Restablecer Contraseña - Cotizador AMES',
      html,
      this.emailFrom,
    );
  }
}
