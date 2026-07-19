import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  TenantConfig,
  TenantConfigDocument,
} from './schemas/tenant-config.schema';
import { TenantContextService } from './tenant-context.service';
import { UpdateTenantBrandingDto } from './dto/update-tenant-branding.dto';
import { UpdateTenantEmailDto } from './dto/update-tenant-email.dto';
import { UpdateTenantVigenciaBancariosDto } from './dto/update-tenant-vigencia-bancarios.dto';

const LOGO_DIR = join(process.cwd(), 'uploads', 'tenant-logos');
const BANK_LOGO_DIR = join(process.cwd(), 'uploads', 'tenant-bank-logos');
const MAX_LOGO_BYTES = 1_000_000;
const LOGO_EXTS = ['.png', '.jpg', '.jpeg', '.webp'] as const;
const ALLOWED_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
};

@Injectable()
export class TenantConfigService {
  constructor(
    @InjectModel(TenantConfig.name)
    private readonly tenantConfigModel: Model<TenantConfigDocument>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private isDuplicateKeyError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      ((err as { code?: number | string }).code === 11000 ||
        (err as { code?: number | string }).code === 'E11000')
    );
  }

  private ensureLogoDir() {
    if (!existsSync(LOGO_DIR)) {
      mkdirSync(LOGO_DIR, { recursive: true });
    }
  }

  private ensureBankLogoDir() {
    if (!existsSync(BANK_LOGO_DIR)) {
      mkdirSync(BANK_LOGO_DIR, { recursive: true });
    }
  }

  private logoPublicUrl(tenantId: Types.ObjectId, ext: string): string {
    return `/uploads/tenant-logos/${String(tenantId)}${ext}`;
  }

  private bankLogoPublicUrl(tenantId: Types.ObjectId, ext: string): string {
    return `/uploads/tenant-bank-logos/${String(tenantId)}${ext}`;
  }

  /** Normaliza mime: lowercase + sin parámetros (p.ej. `; charset=binary`). */
  private normalizeMime(raw?: string): string {
    if (!raw) return '';
    return raw.split(';')[0].trim().toLowerCase();
  }

  private removeLogoFiles(
    tenantId: Types.ObjectId,
    keepExt?: string,
  ) {
    for (const ext of LOGO_EXTS) {
      if (keepExt && ext === keepExt) continue;
      const p = join(LOGO_DIR, `${String(tenantId)}${ext}`);
      if (existsSync(p)) {
        try {
          unlinkSync(p);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private removeBankLogoFiles(
    tenantId: Types.ObjectId,
    keepExt?: string,
  ) {
    for (const ext of LOGO_EXTS) {
      if (keepExt && ext === keepExt) continue;
      const p = join(BANK_LOGO_DIR, `${String(tenantId)}${ext}`);
      if (existsSync(p)) {
        try {
          unlinkSync(p);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private assertValidLogoFile(file: Express.Multer.File): string {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo de logo requerido');
    }
    if (file.size > MAX_LOGO_BYTES) {
      throw new BadRequestException('El logo no puede superar 1MB');
    }
    const mime = this.normalizeMime(file.mimetype);
    const ext = ALLOWED_MIME[mime];
    if (!ext) {
      throw new BadRequestException(
        'Tipo de imagen no permitido (use PNG, JPEG o WebP)',
      );
    }
    return ext;
  }

  /** Upsert atómico: shell vacío si no existe (evita TOCTOU). */
  async findOrCreateForTenant(
    tenantId: Types.ObjectId,
  ): Promise<TenantConfigDocument> {
    try {
      const doc = await this.tenantConfigModel
        .findOneAndUpdate(
          { tenantId },
          { $setOnInsert: { tenantId, branding: {}, correosNotificacion: [], vigenciaDefaultDias: 30, bancarios: {} } },
          { upsert: true, new: true },
        )
        .exec();
      if (!doc) {
        throw new Error('No se pudo crear/obtener TenantConfig');
      }
      return doc;
    } catch (err) {
      if (this.isDuplicateKeyError(err)) {
        const again = await this.tenantConfigModel.findOne({ tenantId }).exec();
        if (again) return again;
      }
      throw err;
    }
  }

  async getForRequest(): Promise<TenantConfigDocument> {
    const tenantId = this.tenantContext.getTenantId();
    return this.findOrCreateForTenant(tenantId);
  }

  /** Lectura sin upsert — uso seguro desde superficie pública (Story 6.9). */
  async findByTenantId(
    tenantId: Types.ObjectId,
  ): Promise<TenantConfigDocument | null> {
    return this.tenantConfigModel.findOne({ tenantId }).exec();
  }

  /** Defense in depth: trim/lower/dedupe/tope (también se aplica en DTO). */
  private normalizeNotificacionList(
    raw: string[] | null | undefined,
  ): string[] {
    if (raw === null || raw === undefined) return [];
    if (!Array.isArray(raw)) {
      throw new BadRequestException(
        'correosNotificacion debe ser un arreglo de emails',
      );
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of raw) {
      if (typeof item !== 'string') {
        throw new BadRequestException(
          'correosNotificacion debe ser un arreglo de strings (emails)',
        );
      }
      const e = item.trim().toLowerCase();
      if (!e || seen.has(e)) continue;
      if (e.length > 120) {
        throw new BadRequestException(
          'Cada correo de notificación no puede superar 120 caracteres',
        );
      }
      seen.add(e);
      out.push(e);
      if (out.length > 20) {
        throw new BadRequestException(
          'correosNotificacion admite como máximo 20 correos',
        );
      }
    }
    return out;
  }

  async updateBranding(
    dto: UpdateTenantBrandingDto,
  ): Promise<TenantConfigDocument> {
    const tenantId = this.tenantContext.getTenantId();
    await this.findOrCreateForTenant(tenantId);

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};

    const applyField = (path: string, value: string | null | undefined) => {
      if (value === undefined) return;
      if (value === '' || value === null) {
        $unset[path] = 1;
      } else {
        $set[path] = value;
      }
    };

    applyField('branding.razonSocial', dto.razonSocial);
    applyField('branding.rfc', dto.rfc);
    applyField('branding.domicilio', dto.domicilio);
    applyField('branding.telefono', dto.telefono);
    applyField('branding.emailContacto', dto.emailContacto);
    applyField('branding.sitioWeb', dto.sitioWeb);

    if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
      return this.findOrCreateForTenant(tenantId);
    }

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;

    const updated = await this.tenantConfigModel
      .findOneAndUpdate({ tenantId }, update, { new: true })
      .exec();
    if (!updated) {
      throw new BadRequestException('No se pudo actualizar branding');
    }
    return updated;
  }

  async updateEmailConfig(
    dto: UpdateTenantEmailDto,
  ): Promise<TenantConfigDocument> {
    const tenantId = this.tenantContext.getTenantId();
    await this.findOrCreateForTenant(tenantId);

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};

    if (dto.emailRemitente !== undefined) {
      if (dto.emailRemitente === '' || dto.emailRemitente === null) {
        $unset.emailRemitente = 1;
      } else {
        $set.emailRemitente = dto.emailRemitente;
      }
    }

    if (dto.correosNotificacion !== undefined) {
      $set.correosNotificacion = this.normalizeNotificacionList(
        dto.correosNotificacion,
      );
    }

    if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
      return this.findOrCreateForTenant(tenantId);
    }

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;

    const updated = await this.tenantConfigModel
      .findOneAndUpdate({ tenantId }, update, { new: true })
      .exec();
    if (!updated) {
      throw new BadRequestException('No se pudo actualizar configuración de email');
    }
    return updated;
  }

  async updateVigenciaBancarios(
    dto: UpdateTenantVigenciaBancariosDto,
  ): Promise<TenantConfigDocument> {
    const tenantId = this.tenantContext.getTenantId();
    await this.findOrCreateForTenant(tenantId);

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};

    if (dto.vigenciaDefaultDias !== undefined) {
      $set.vigenciaDefaultDias = dto.vigenciaDefaultDias;
    }

    if (dto.bancarios === null) {
      $unset.bancarios = 1;
    } else if (dto.bancarios !== undefined) {
      const applyField = (path: string, value: string | null | undefined) => {
        if (value === undefined) return;
        if (value === '' || value === null) {
          $unset[path] = 1;
        } else {
          $set[path] = value;
        }
      };
      applyField('bancarios.titular', dto.bancarios.titular);
      applyField('bancarios.banco', dto.bancarios.banco);
      applyField('bancarios.cuenta', dto.bancarios.cuenta);
      applyField('bancarios.clabe', dto.bancarios.clabe);
      applyField('bancarios.domicilio', dto.bancarios.domicilio);
      applyField('bancarios.rfc', dto.bancarios.rfc);
      applyField('bancarios.email', dto.bancarios.email);
    }

    if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
      return this.findOrCreateForTenant(tenantId);
    }

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;

    const updated = await this.tenantConfigModel
      .findOneAndUpdate({ tenantId }, update, { new: true })
      .exec();
    if (!updated) {
      throw new BadRequestException(
        'No se pudo actualizar vigencia/datos bancarios',
      );
    }
    return updated;
  }

  async saveLogo(
    file: Express.Multer.File,
  ): Promise<TenantConfigDocument> {
    const ext = this.assertValidLogoFile(file);
    const tenantId = this.tenantContext.getTenantId();
    await this.findOrCreateForTenant(tenantId);
    this.ensureLogoDir();

    const dest = join(LOGO_DIR, `${String(tenantId)}${ext}`);
    try {
      writeFileSync(dest, file.buffer);
    } catch {
      throw new BadRequestException('No se pudo escribir el logo en disco');
    }

    this.removeLogoFiles(tenantId, ext);

    const logoUrl = this.logoPublicUrl(tenantId, ext);
    try {
      const updated = await this.tenantConfigModel
        .findOneAndUpdate(
          { tenantId },
          { $set: { 'branding.logoUrl': logoUrl } },
          { new: true },
        )
        .exec();
      if (!updated) {
        try {
          unlinkSync(dest);
        } catch {
          /* ignore */
        }
        throw new BadRequestException('No se pudo guardar el logo');
      }
      return updated;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      try {
        unlinkSync(dest);
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  async clearLogo(): Promise<TenantConfigDocument> {
    const tenantId = this.tenantContext.getTenantId();
    await this.findOrCreateForTenant(tenantId);
    const updated = await this.tenantConfigModel
      .findOneAndUpdate(
        { tenantId },
        { $unset: { 'branding.logoUrl': 1 } },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new BadRequestException('No se pudo eliminar el logo');
    }
    this.removeLogoFiles(tenantId);
    return updated;
  }

  async saveBankLogo(
    file: Express.Multer.File,
  ): Promise<TenantConfigDocument> {
    const ext = this.assertValidLogoFile(file);
    const tenantId = this.tenantContext.getTenantId();
    await this.findOrCreateForTenant(tenantId);
    this.ensureBankLogoDir();

    const dest = join(BANK_LOGO_DIR, `${String(tenantId)}${ext}`);
    try {
      writeFileSync(dest, file.buffer);
    } catch {
      throw new BadRequestException(
        'No se pudo escribir el logo del banco en disco',
      );
    }

    this.removeBankLogoFiles(tenantId, ext);

    const logoUrl = this.bankLogoPublicUrl(tenantId, ext);
    try {
      const updated = await this.tenantConfigModel
        .findOneAndUpdate(
          { tenantId },
          { $set: { 'bancarios.logoUrl': logoUrl } },
          { new: true },
        )
        .exec();
      if (!updated) {
        try {
          unlinkSync(dest);
        } catch {
          /* ignore */
        }
        throw new BadRequestException('No se pudo guardar el logo del banco');
      }
      return updated;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      try {
        unlinkSync(dest);
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  async clearBankLogo(): Promise<TenantConfigDocument> {
    const tenantId = this.tenantContext.getTenantId();
    await this.findOrCreateForTenant(tenantId);
    const updated = await this.tenantConfigModel
      .findOneAndUpdate(
        { tenantId },
        { $unset: { 'bancarios.logoUrl': 1 } },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new BadRequestException('No se pudo eliminar el logo del banco');
    }
    this.removeBankLogoFiles(tenantId);
    return updated;
  }

  toResponse(doc: TenantConfigDocument) {
    const obj = doc.toObject ? doc.toObject() : (doc as any);
    const branding = obj.branding || {};
    const bancarios = obj.bancarios || {};
    return {
      _id: String(obj._id),
      tenantId: String(obj.tenantId),
      branding: {
        logoUrl: branding.logoUrl || undefined,
        razonSocial: branding.razonSocial || undefined,
        rfc: branding.rfc || undefined,
        domicilio: branding.domicilio || undefined,
        telefono: branding.telefono || undefined,
        emailContacto: branding.emailContacto || undefined,
        sitioWeb: branding.sitioWeb || undefined,
      },
      emailRemitente: obj.emailRemitente || undefined,
      correosNotificacion: Array.isArray(obj.correosNotificacion)
        ? obj.correosNotificacion
        : [],
      vigenciaDefaultDias:
        typeof obj.vigenciaDefaultDias === 'number'
          ? obj.vigenciaDefaultDias
          : 30,
      bancarios: {
        logoUrl: bancarios.logoUrl || undefined,
        titular: bancarios.titular || undefined,
        banco: bancarios.banco || undefined,
        cuenta: bancarios.cuenta || undefined,
        clabe: bancarios.clabe || undefined,
        domicilio: bancarios.domicilio || undefined,
        rfc: bancarios.rfc || undefined,
        email: bancarios.email || undefined,
      },
      createdAt: obj.createdAt
        ? new Date(obj.createdAt).toISOString()
        : undefined,
      updatedAt: obj.updatedAt
        ? new Date(obj.updatedAt).toISOString()
        : undefined,
    };
  }
}
