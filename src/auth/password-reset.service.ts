import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import {
  PasswordResetToken,
  PasswordResetTokenDocument,
} from './schemas/password-reset-token.schema';
import { EmailsService } from '../emails/emails.service';
import { UsersService } from '../users/users.service';
import { ClientesService } from '../clientes/clientes.service';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectModel(PasswordResetToken.name)
    private passwordResetTokenModel: Model<PasswordResetTokenDocument>,
    private emailsService: EmailsService,
    private usersService: UsersService,
    private clientesService: ClientesService,
  ) {}

  /**
   * Genera un token aleatorio de 64 caracteres
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hashea un token usando SHA-256
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Crea un token de reset y envía el email (usuarios admin)
   */
  async createResetTokenForAdmin(email: string): Promise<void> {
    // Buscar usuario
    const user = await this.usersService.findByEmail(email);

    // Siempre responder de forma genérica para evitar enumeración
    if (!user) {
      this.logger.warn(
        `Password reset requested for non-existent admin email: ${email}`,
      );
      // No lanzar error, solo retornar
      return;
    }

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Invalidar tokens anteriores eliminándolos
    await this.passwordResetTokenModel
      .deleteMany({ email, userType: 'admin' })
      .exec();

    // Crear nuevo token
    await this.passwordResetTokenModel.create({
      email,
      tokenHash,
      userType: 'admin',
      expiresAt,
    });

    // Enviar email
    try {
      await this.emailsService.sendPasswordResetEmail(
        email,
        user.nombre,
        token,
        'admin',
      );
      this.logger.log(`Password reset email sent to admin: ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}:`,
        error,
      );
      throw new BadRequestException(
        'Error al enviar el correo de recuperación',
      );
    }
  }

  /**
   * Crea un token de reset y envía el email (usuarios cliente)
   */
  async createResetTokenForCliente(email: string): Promise<void> {
    // Buscar usuario cliente
    const usuarioCliente =
      await this.clientesService.findUsuarioClienteByEmail(email);

    // Siempre responder de forma genérica para evitar enumeración
    if (!usuarioCliente) {
      this.logger.warn(
        `Password reset requested for non-existent cliente email: ${email}`,
      );
      // No lanzar error, solo retornar
      return;
    }

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Invalidar tokens anteriores
    await this.passwordResetTokenModel
      .deleteMany({ email, userType: 'cliente' })
      .exec();

    // Crear nuevo token
    await this.passwordResetTokenModel.create({
      email,
      tokenHash,
      userType: 'cliente',
      expiresAt,
    });

    // Enviar email
    try {
      await this.emailsService.sendPasswordResetEmail(
        email,
        usuarioCliente.nombre,
        token,
        'cliente',
      );
      this.logger.log(`Password reset email sent to cliente: ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}:`,
        error,
      );
      throw new BadRequestException(
        'Error al enviar el correo de recuperación',
      );
    }
  }

  /**
   * Valida un token de reset
   */
  async validateToken(
    email: string,
    token: string,
    userType: 'admin' | 'cliente',
  ): Promise<boolean> {
    const tokenHash = this.hashToken(token);

    const resetToken = await this.passwordResetTokenModel
      .findOne({
        email,
        tokenHash,
        userType,
        expiresAt: { $gte: new Date() },
        usedAt: { $exists: false },
      })
      .exec();

    return !!resetToken;
  }

  /**
   * Restablece la contraseña del usuario (admin)
   */
  async resetPasswordForAdmin(
    email: string,
    token: string,
    newPassword: string,
  ): Promise<void> {
    const tokenHash = this.hashToken(token);

    const resetToken = await this.passwordResetTokenModel
      .findOne({
        email,
        tokenHash,
        userType: 'admin',
        expiresAt: { $gte: new Date() },
        usedAt: { $exists: false },
      })
      .exec();

    if (!resetToken) {
      throw new BadRequestException('Token inválido, expirado o ya utilizado');
    }

    // Buscar usuario
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Actualizar contraseña
    await this.usersService.update(user._id.toString(), {
      password: newPassword,
    });

    // Marcar token como usado
    resetToken.usedAt = new Date();
    await resetToken.save();

    this.logger.log(`Password reset successfully for admin: ${email}`);
  }

  /**
   * Restablece la contraseña del usuario (cliente)
   */
  async resetPasswordForCliente(
    email: string,
    token: string,
    newPassword: string,
  ): Promise<void> {
    const tokenHash = this.hashToken(token);

    const resetToken = await this.passwordResetTokenModel
      .findOne({
        email,
        tokenHash,
        userType: 'cliente',
        expiresAt: { $gte: new Date() },
        usedAt: { $exists: false },
      })
      .exec();

    if (!resetToken) {
      throw new BadRequestException('Token inválido, expirado o ya utilizado');
    }

    // Buscar usuario cliente
    const usuarioCliente =
      await this.clientesService.findUsuarioClienteByEmail(email);
    if (!usuarioCliente) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Actualizar contraseña
    const usuarioClienteDoc = usuarioCliente as any;
    await this.clientesService.updateUsuarioClientePassword(
      usuarioClienteDoc._id.toString(),
      newPassword,
    );

    // Marcar token como usado
    resetToken.usedAt = new Date();
    await resetToken.save();

    this.logger.log(`Password reset successfully for cliente: ${email}`);
  }
}
