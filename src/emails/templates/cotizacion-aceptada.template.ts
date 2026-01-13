/**
 * Template HTML para el email de cotización aceptada y orden de trabajo generada
 */
export interface CotizacionAceptadaData {
  nombreCliente: string;
  nombreUsuario: string;
  folioCotizacion: string;
  folioOrdenTrabajo: string;
  fechaAceptacion: string;
  subTotalCotizacion: string;
  ivaCotizacion: string;
  totalCotizacion: string;
  cantidadTrabajadores: number;
  linkMisCotizaciones: string;
  linkMisOrdenes: string;
}

export function cotizacionAceptadaTemplate(
  data: CotizacionAceptadaData,
): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cotización Aceptada</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">✓ Cotización Aceptada</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                Hola <strong>${data.nombreUsuario}</strong>,
              </p>
              <p style="margin: 0 0 30px; font-size: 16px; color: #333333; line-height: 1.6;">
                Tu cotización ha sido <strong style="color: #10b981;">aceptada exitosamente</strong> y se ha generado una nueva orden de trabajo.
              </p>
              
              <!-- Cotización Info -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 6px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 20px;">
                    <h2 style="margin: 0 0 15px; font-size: 18px; color: #10b981; font-weight: 600;">📋 Detalles de la Cotización</h2>
                    <table width="100%" cellpadding="8" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size: 14px; color: #666666; width: 40%;">Folio:</td>
                        <td style="font-size: 14px; color: #333333; font-weight: 600;">${data.folioCotizacion}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #666666;">Fecha de Aceptación:</td>
                        <td style="font-size: 14px; color: #333333; font-weight: 600;">${data.fechaAceptacion}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #666666;">Subtotal:</td>
                        <td style="font-size: 14px; color: #333333; font-weight: 500;">${data.subTotalCotizacion}</td>
                      </tr>

                      <tr>
                        <td style="font-size: 14px; color: #666666;">IVA:</td>
                        <td style="font-size: 14px; color: #333333; font-weight: 500;">${data.ivaCotizacion}</td>
                      </tr>

                      <tr>
                        <td colspan="2" style="border-top: 1px solid #e5e7eb;"></td>
                      </tr>

                      <tr>
                        <td style="font-size: 15px; color: #111827; font-weight: 700;">Total:</td>
                        <td style="font-size: 18px; color: #10b981; font-weight: 800;">${data.totalCotizacion}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Orden de Trabajo Info -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f9ff; border-radius: 6px; margin-bottom: 30px; border-left: 4px solid #3b82f6;">
                <tr>
                  <td style="padding: 20px;">
                    <h2 style="margin: 0 0 15px; font-size: 18px; color: #3b82f6; font-weight: 600;">📄 Orden de Trabajo Generada</h2>
                    <table width="100%" cellpadding="8" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size: 14px; color: #666666; width: 40%;">Folio:</td>
                        <td style="font-size: 14px; color: #333333; font-weight: 600;">${data.folioOrdenTrabajo}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #666666;">Trabajadores:</td>
                        <td style="font-size: 14px; color: #333333; font-weight: 600;">${data.cantidadTrabajadores}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #666666;">Estado:</td>
                        <td style="font-size: 14px; color: #f59e0b; font-weight: 600;">Pendiente</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTAs -->
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                Puedes revisar el estado de tu cotización y orden de trabajo en tu portal de cliente:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 15px;">
                    <a href="${data.linkMisCotizaciones}" style="display: inline-block; padding: 12px 30px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">
                      Ver Mis Cotizaciones
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="${data.linkMisOrdenes}" style="display: inline-block; padding: 12px 30px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">
                      Ver Órdenes de Trabajo
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; font-size: 14px; color: #999999; line-height: 1.6;">
                Si tienes alguna pregunta, no dudes en contactarnos.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; font-size: 13px; color: #999999;">
                © ${new Date().getFullYear()} Cotizador. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
