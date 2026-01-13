/**
 * Template HTML para el email de restablecimiento de contraseña
 */
export function passwordResetTemplate(
  nombre: string,
  resetUrl: string,
  tipoUsuario: 'admin' | 'cliente',
): string {
  const greeting = tipoUsuario === 'admin' ? 'Administrador' : 'Cliente';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer Contraseña</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Restablecer Contraseña</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                Hola <strong>${nombre}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta de ${greeting}.
              </p>
              <p style="margin: 0 0 30px; font-size: 16px; color: #333333; line-height: 1.6;">
                Haz clic en el siguiente botón para crear una nueva contraseña:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);">
                      Restablecer Contraseña
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0 20px; font-size: 14px; color: #666666; line-height: 1.6;">
                Si no puedes hacer clic en el botón, copia y pega el siguiente enlace en tu navegador:
              </p>
              <p style="margin: 0 0 20px; font-size: 13px; color: #667eea; word-break: break-all; background-color: #f8f9fa; padding: 12px; border-radius: 4px; border-left: 4px solid #667eea;">
                ${resetUrl}
              </p>
              <p style="margin: 30px 0 0; font-size: 14px; color: #999999; line-height: 1.6;">
                <strong>Este enlace expirará en 1 hora.</strong>
              </p>
              <p style="margin: 10px 0 0; font-size: 14px; color: #999999; line-height: 1.6;">
                Si no solicitaste este cambio, puedes ignorar este correo electrónico.
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
