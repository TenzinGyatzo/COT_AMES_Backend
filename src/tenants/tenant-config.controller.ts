import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UseFilters,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles as RolesDecorator } from '../auth/decorators/roles.decorator';
import { AMES_ROLES, Roles } from '../auth/enums/roles.enum';
import {
  TenantContextGuard,
  X_TENANT_ID_API_HEADER,
} from './tenant-context.guard';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantConfigService } from './tenant-config.service';
import { TenantConfigResponseDto } from './dto/tenant-config-response.dto';
import { UpdateTenantBrandingDto } from './dto/update-tenant-branding.dto';
import { UpdateTenantEmailDto } from './dto/update-tenant-email.dto';
import { UpdateTenantVigenciaBancariosDto } from './dto/update-tenant-vigencia-bancarios.dto';
import { MulterBadRequestFilter } from './multer-bad-request.filter';

/** Escritura config: admin_tenant | admin_sistema (FR42 / AD-16 / Story 2.4). */
const CONFIG_WRITE_ROLES = [Roles.ADMIN_TENANT, Roles.ADMIN_SISTEMA] as const;

@ApiTags('tenant-config')
@Controller('tenant-config')
@UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard)
@UseInterceptors(TenantContextInterceptor)
@RolesDecorator(...AMES_ROLES)
@ApiBearerAuth()
@ApiHeader({
  ...X_TENANT_ID_API_HEADER,
  required: false,
  description:
    'Obligatorio para admin_sistema. Operativo y admin_tenant: no enviar (tenant del JWT). Define qué configuración se lee/escribe (AD-2).',
})
export class TenantConfigController {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtener configuración del tenant activo',
    description:
      'Roles AMES (operativo | admin_tenant | admin_sistema). Lectura para PDF/núcleo. Escritura restringida a admin_tenant | admin_sistema (Story 2.4 / FR42).',
  })
  @ApiResponse({ status: 200, type: TenantConfigResponseDto })
  @ApiResponse({
    status: 400,
    description: 'X-Tenant-Id ausente o ambiguo (admin_sistema)',
  })
  @ApiResponse({ status: 401, description: 'JWT ausente o inválido' })
  @ApiResponse({
    status: 403,
    description:
      'Rol no AMES; o X-Tenant-Id inválido / tenant inexistente o inactivo',
  })
  async get() {
    const doc = await this.tenantConfigService.getForRequest();
    return this.tenantConfigService.toResponseAsync(doc);
  }

  @Patch('branding')
  @RolesDecorator(...CONFIG_WRITE_ROLES)
  @ApiOperation({
    summary: 'Actualizar branding y datos legales del tenant activo',
    description:
      'Partial update. String vacío limpia el campo. No incluye logo (usar POST/DELETE logo). admin_tenant | admin_sistema (FR42).',
  })
  @ApiBody({ type: UpdateTenantBrandingDto })
  @ApiResponse({ status: 200, type: TenantConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Validación o X-Tenant-Id' })
  @ApiResponse({
    status: 403,
    description: 'operativo u otro rol sin permiso / tenant inválido',
  })
  async patchBranding(@Body() dto: UpdateTenantBrandingDto) {
    const doc = await this.tenantConfigService.updateBranding(dto);
    return this.tenantConfigService.toResponseAsync(doc);
  }

  @Patch('email')
  @RolesDecorator(...CONFIG_WRITE_ROLES)
  @ApiOperation({
    summary:
      'Actualizar remitente, notificaciones y credenciales SMTP del tenant',
    description:
      'Partial update. emailRemitente vacío limpia. correosNotificacion: [] es válido. emailUser + emailPass (app password) → cifra a emailSecretEnc (FR55). Response nunca incluye el secret. admin_tenant | admin_sistema (FR42).',
  })
  @ApiBody({ type: UpdateTenantEmailDto })
  @ApiResponse({ status: 200, type: TenantConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Validación o X-Tenant-Id' })
  @ApiResponse({
    status: 403,
    description: 'operativo u otro rol sin permiso / tenant inválido',
  })
  async patchEmail(@Body() dto: UpdateTenantEmailDto) {
    const doc = await this.tenantConfigService.updateEmailConfig(dto);
    return this.tenantConfigService.toResponseAsync(doc);
  }

  @Patch('vigencia-bancarios')
  @RolesDecorator(...CONFIG_WRITE_ROLES)
  @ApiOperation({
    summary: 'Actualizar vigencia default y datos bancarios del tenant activo',
    description:
      'Partial update. admin_tenant | admin_sistema (FR42). String vacío limpia subcampo bancario.',
  })
  @ApiBody({ type: UpdateTenantVigenciaBancariosDto })
  @ApiResponse({ status: 200, type: TenantConfigResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Validación (días fuera de rango, etc.)',
  })
  @ApiResponse({
    status: 403,
    description: 'operativo u otro rol sin permiso / tenant inválido',
  })
  async patchVigenciaBancarios(@Body() dto: UpdateTenantVigenciaBancariosDto) {
    const doc = await this.tenantConfigService.updateVigenciaBancarios(dto);
    return this.tenantConfigService.toResponseAsync(doc);
  }

  @Post('branding/logo')
  @RolesDecorator(...CONFIG_WRITE_ROLES)
  @ApiOperation({
    summary: 'Subir o reemplazar logo del tenant activo',
    description: 'admin_tenant | admin_sistema (FR42).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, type: TenantConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Archivo inválido / tamaño / mime' })
  @ApiResponse({
    status: 403,
    description: 'operativo u otro rol sin permiso / tenant inválido',
  })
  @UseFilters(MulterBadRequestFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 1_000_000 },
    }),
  )
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Archivo de logo requerido');
    }
    const doc = await this.tenantConfigService.saveLogo(file);
    return this.tenantConfigService.toResponseAsync(doc);
  }

  @Delete('branding/logo')
  @RolesDecorator(...CONFIG_WRITE_ROLES)
  @ApiOperation({
    summary: 'Eliminar logo del tenant activo',
    description: 'admin_tenant | admin_sistema (FR42).',
  })
  @ApiResponse({ status: 200, type: TenantConfigResponseDto })
  @ApiResponse({
    status: 403,
    description: 'operativo u otro rol sin permiso / tenant inválido',
  })
  async deleteLogo() {
    const doc = await this.tenantConfigService.clearLogo();
    return this.tenantConfigService.toResponseAsync(doc);
  }

  @Post('bancarios/logo')
  @RolesDecorator(...CONFIG_WRITE_ROLES)
  @ApiOperation({
    summary: 'Subir o reemplazar logo del banco',
    description:
      'No pisa branding.logoUrl. admin_tenant | admin_sistema (FR42). PNG/JPEG/WebP ≤1MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, type: TenantConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Archivo inválido / tamaño / mime' })
  @ApiResponse({
    status: 403,
    description: 'operativo u otro rol sin permiso / tenant inválido',
  })
  @UseFilters(MulterBadRequestFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 1_000_000 },
    }),
  )
  async uploadBankLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Archivo de logo requerido');
    }
    const doc = await this.tenantConfigService.saveBankLogo(file);
    return this.tenantConfigService.toResponseAsync(doc);
  }

  @Delete('bancarios/logo')
  @RolesDecorator(...CONFIG_WRITE_ROLES)
  @ApiOperation({
    summary: 'Eliminar logo del banco del tenant activo',
    description: 'admin_tenant | admin_sistema (FR42).',
  })
  @ApiResponse({ status: 200, type: TenantConfigResponseDto })
  @ApiResponse({
    status: 403,
    description: 'operativo u otro rol sin permiso / tenant inválido',
  })
  async deleteBankLogo() {
    const doc = await this.tenantConfigService.clearBankLogo();
    return this.tenantConfigService.toResponseAsync(doc);
  }
}
