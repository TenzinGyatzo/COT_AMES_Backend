/** Tenant.activo === false — bloquea outbound (Story 3.4 / AD-14). */
export class TenantInactiveForOutboundError extends Error {
  constructor(message = 'Tenant inactivo para envío de correo') {
    super(message);
    this.name = 'TenantInactiveForOutboundError';
  }
}
