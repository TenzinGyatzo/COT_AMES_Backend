import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  IWhatsappNotificationData,
  IWhatsappResponse,
} from './interfaces/whatsapp-notification.interface';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly apiUrl: string;
  private readonly token: string;
  private readonly phoneNumberId: string;
  private readonly adminPhone: string;
  private readonly templateName: string;
  private readonly isEnabled: boolean;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const apiVersion = this.configService.get<string>('WHATSAPP_API_VERSION', 'v18.0');
    this.token = this.configService.get<string>('WHATSAPP_CLOUD_API_TOKEN');
    this.phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    this.templateName = this.configService.get<string>('WHATSAPP_TEMPLATE_NAME');
    
    // Normalizar el número del administrador
    const rawAdminPhone = this.configService.get<string>('WHATSAPP_ADMIN_PHONE', '');
    this.adminPhone = this.normalizePhoneNumber(rawAdminPhone);

    this.apiUrl = `https://graph.facebook.com/${apiVersion}/${this.phoneNumberId}/messages`;

    // Feature Flag: WHATSAPP_ENABLED (default false)
    const enabledRaw = this.configService.get<string | boolean>('WHATSAPP_ENABLED', false);
    this.isEnabled = enabledRaw === 'true' || enabledRaw === true;
  }

  /**
   * Normaliza un número al formato E.164 (sin +, espacios ni guiones)
   */
  private normalizePhoneNumber(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Envía una notificación de cotización aceptada al administrador
   */
  async sendCotizacionAceptadaNotification(
    data: IWhatsappNotificationData,
  ): Promise<IWhatsappResponse> {
    const { 
      folio, 
      clienteNombre, 
      total, 
      currency = 'MXN', 
      languageCode = 'es_MX' 
    } = data;
    
    if (!this.isEnabled) {
      return { success: false, error: 'disabled' };
    }

    if (!this.token || !this.phoneNumberId || !this.adminPhone || !this.templateName) {
      const errorMsg = 'Configuración de WhatsApp incompleta en variables de entorno';
      this.logger.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.adminPhone,
      type: 'template',
      template: {
        name: this.templateName,
        language: {
          code: languageCode,
        },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: folio },
              { type: 'text', text: clienteNombre },
              { type: 'text', text: `${total} ${currency}` },
            ],
          },
        ],
      },
    };

    try {
      this.logger.log(
        `Enviando notificación de WhatsApp para cotización ${folio} a ${this.adminPhone}`,
      );

      const response = await firstValueFrom(
        this.httpService.post(this.apiUrl, payload, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // Timeout de 10 segundos
        }),
      );

      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id,
      };
    } catch (error) {
      let errorMessage = error.message;
      let errorCode = 'UNKNOWN_ERROR';
      let statusCode = error.response?.status || 500;

      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Timeout al contactar con Meta Cloud API (10s excedidos)';
        errorCode = 'TIMEOUT_ERROR';
      } else if (error.response?.data?.error) {
        // Extraer info de error específica de Meta sin loguear todo el dump
        const metaError = error.response.data.error;
        errorCode = metaError.code || errorCode;
        errorMessage = metaError.message || errorMessage;
      }

      this.logger.error(
        `WhatsApp Error [Status: ${statusCode}] [Code: ${errorCode}]: ${errorMessage}`,
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
