export interface IWhatsappNotificationData {
  folio: string;
  clienteNombre: string;
  total: number;
  currency?: string;
  languageCode?: string;
}

export interface IWhatsappResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}
