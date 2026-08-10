/** Sin emailUser/emailSecretEnc del tenant — bloquea outbound (Story 3.4 / AD-12). */
export class TenantEmailNotConfiguredError extends Error {
  constructor(
    message = 'Credenciales de correo del tenant no configuradas',
  ) {
    super(message);
    this.name = 'TenantEmailNotConfiguredError';
  }
}
