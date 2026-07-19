import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TenantBrandingDto {
  @ApiPropertyOptional()
  logoUrl?: string;

  @ApiPropertyOptional()
  razonSocial?: string;

  @ApiPropertyOptional()
  rfc?: string;

  @ApiPropertyOptional()
  domicilio?: string;

  @ApiPropertyOptional()
  telefono?: string;

  @ApiPropertyOptional()
  emailContacto?: string;

  @ApiPropertyOptional()
  sitioWeb?: string;
}

export class TenantBancariosDto {
  @ApiPropertyOptional()
  titular?: string;

  @ApiPropertyOptional()
  banco?: string;

  @ApiPropertyOptional()
  cuenta?: string;

  @ApiPropertyOptional()
  clabe?: string;

  @ApiPropertyOptional()
  domicilio?: string;

  @ApiPropertyOptional()
  rfc?: string;

  @ApiPropertyOptional()
  email?: string;
}

export class TenantConfigResponseDto {
  @ApiProperty()
  _id: string;

  @ApiProperty({ description: 'Tenant efectivo (AD-2 / X-Tenant-Id)' })
  tenantId: string;

  @ApiPropertyOptional({ type: TenantBrandingDto })
  branding?: TenantBrandingDto;

  @ApiPropertyOptional({
    description: 'Remitente From de cotizaciones (Story 2.3)',
  })
  emailRemitente?: string;

  @ApiPropertyOptional({
    description: 'Correos adicionales de notificación (puede ser [])',
    type: [String],
  })
  correosNotificacion?: string[];

  @ApiPropertyOptional({
    description: 'Días de vigencia default al crear cotización (Story 2.4)',
  })
  vigenciaDefaultDias?: number;

  @ApiPropertyOptional({
    type: TenantBancariosDto,
    description: 'Contenido bancario para PDF (Story 2.4)',
  })
  bancarios?: TenantBancariosDto;

  @ApiPropertyOptional()
  createdAt?: string;

  @ApiPropertyOptional()
  updatedAt?: string;
}
