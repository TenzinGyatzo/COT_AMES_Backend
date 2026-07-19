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
import { AdminGuard } from '../auth/guards/admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles as RolesDecorator } from '../auth/decorators/roles.decorator';
import { AMES_ROLES } from '../auth/enums/roles.enum';
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
    'Obligatorio para admin_sistema. Operativo: no enviar (tenant del JWT). Define qué configuración se lee/escribe (AD-2).',
})
export class TenantConfigController {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtener configuración del tenant activo',
    description:
      'Roles AMES (operativo + admin_sistema). Si no existe documento, crea shell. Incluye branding, email, vigencia y bancarios (2.2–2.4). Escritura sigue restringida a admin_sistema.',
  })
  @ApiResponse({ status: 200, type: TenantConfigResponseDto })
  @ApiResponse({ status: 400, description: 'X-Tenant-Id ausente o ambiguo (admin)' })
  @ApiResponse({ status: 401, description: 'JWT ausente o inválido' })
  @ApiResponse({
    status: 403,
    description:
      'Rol no AMES; o X-Tenant-Id inválido / tenant inexistente o inactivo',
  })
  async get() {
    const doc = await this.tenantConfigService.getForRequest();
    return this.tenantConfigService.toResponse(doc);
  }

  @Patch('branding')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Actualizar branding y datos legales del tenant activo',
    description:
      'Partial update. String vacío limpia el campo. No incluye logo (usar POST/DELETE logo). Solo admin_sistema.',
  })
  @ApiBody({ type: UpdateTenantBrandingDto })
  @ApiResponse({ status: 200, type: TenantConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Validación o X-Tenant-Id' })
  @ApiResponse({ status: 403, description: 'No admin / tenant inválido' })
  async patchBranding(@Body() dto: UpdateTenantBrandingDto) {
    const doc = await this.tenantConfigService.updateBranding(dto);
    return this.tenantConfigService.toResponse(doc);
  }

  @Patch('email')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Actualizar remitente y correos de notificación del tenant',
    description:
      'Partial update (Story 2.3). emailRemitente vacío limpia. correosNotificacion: [] es válido. Solo admin_sistema.',
  })
  @ApiBody({ type: UpdateTenantEmailDto })
  @ApiResponse({ status: 200, type: TenantConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Validación o X-Tenant-Id' })
  @ApiResponse({ status: 403, description: 'No admin / tenant inválido' })
  async patchEmail(@Body() dto: UpdateTenantEmailDto) {
    const doc = await this.tenantConfigService.updateEmailConfig(dto);
    return this.tenantConfigService.toResponse(doc);
  }

  @Patch('vigencia-bancarios')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Actualizar vigencia default y datos bancarios del tenant activo',
    description:
      'Partial update (Story 2.4). Solo admin_sistema. String vacío limpia subcampo bancario.',
  })
  @ApiBody({ type: UpdateTenantVigenciaBancariosDto })
  @ApiResponse({ status: 200, type: TenantConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Validación (días fuera de rango, etc.)' })
  @ApiResponse({ status: 403, description: 'No admin / tenant inválido' })
  async patchVigenciaBancarios(@Body() dto: UpdateTenantVigenciaBancariosDto) {
    const doc = await this.tenantConfigService.updateVigenciaBancarios(dto);
    return this.tenantConfigService.toResponse(doc);
  }

  @Post('branding/logo')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Subir o reemplazar logo del tenant activo' })
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
  @ApiResponse({ status: 403, description: 'No admin / tenant inválido' })
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
    return this.tenantConfigService.toResponse(doc);
  }

  @Delete('branding/logo')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Eliminar logo del tenant activo' })
  @ApiResponse({ status: 200, type: TenantConfigResponseDto })
  @ApiResponse({ status: 403, description: 'No admin / tenant inválido' })
  async deleteLogo() {
    const doc = await this.tenantConfigService.clearLogo();
    return this.tenantConfigService.toResponse(doc);
  }

  @Post('bancarios/logo')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Subir o reemplazar logo del banco (Story 2.5)',
    description:
      'No pisa branding.logoUrl. Solo admin_sistema. PNG/JPEG/WebP ≤1MB.',
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
  @ApiResponse({ status: 403, description: 'No admin / tenant inválido' })
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
    return this.tenantConfigService.toResponse(doc);
  }

  @Delete('bancarios/logo')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Eliminar logo del banco del tenant activo' })
  @ApiResponse({ status: 200, type: TenantConfigResponseDto })
  @ApiResponse({ status: 403, description: 'No admin / tenant inválido' })
  async deleteBankLogo() {
    const doc = await this.tenantConfigService.clearBankLogo();
    return this.tenantConfigService.toResponse(doc);
  }
}
