import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

/**
 * Crea y retorna un transporter de Nodemailer configurado con SMTP
 * @param host - Host del servidor SMTP
 * @param port - Puerto del servidor SMTP
 * @param user - Usuario de autenticación SMTP
 * @param pass - Contraseña de autenticación SMTP
 */
export function createTransporter(
  host: string,
  port: number,
  user: string,
  pass: string,
): Transporter {
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true para puerto 465, false para otros puertos
    auth: {
      user,
      pass,
    },
  });
}
