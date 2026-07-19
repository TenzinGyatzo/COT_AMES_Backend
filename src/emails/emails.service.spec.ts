import { ConfigService } from '@nestjs/config';
import { EmailsService } from './emails.service';
import { passwordResetTemplate } from './templates/password-reset.template';
import { quotationDecisionNotificationTemplate } from './templates/quotation-decision-notification.template';

function makeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const defaults: Record<string, unknown> = {
    FRONTEND_URL: 'http://localhost:5173/',
    EMAIL_HOST: 'smtp.example.com',
    EMAIL_PORT: 587,
    EMAIL_USER: 'u',
    EMAIL_PASS: 'p',
    EMAIL_FROM: 'from@ames.test',
  };
  return {
    get: jest.fn((key: string) =>
      key in overrides ? overrides[key] : defaults[key],
    ),
  } as unknown as ConfigService;
}

describe('EmailsService.sendPasswordResetEmail', () => {
  it('construye URL con /admin/reset-password', async () => {
    const service = new EmailsService(makeConfig());
    const sendEmail = jest
      .spyOn(service as any, 'sendEmail')
      .mockResolvedValue(undefined);

    await service.sendPasswordResetEmail('u@ames.test', 'User', 'tok123');

    expect(sendEmail).toHaveBeenCalledWith(
      'u@ames.test',
      expect.stringContaining('AMES'),
      expect.stringContaining(
        'http://localhost:5173/admin/reset-password?token=tok123&email=u%40ames.test',
      ),
      'from@ames.test',
    );
  });

  it('sin FRONTEND_URL lanza error', async () => {
    const service = new EmailsService(makeConfig({ FRONTEND_URL: undefined }));

    await expect(
      service.sendPasswordResetEmail('u@ames.test', 'User', 'tok'),
    ).rejects.toThrow(/FRONTEND_URL/);
  });
});

describe('passwordResetTemplate', () => {
  it('usa wording AMES neutro', () => {
    const html = passwordResetTemplate('Ana', 'http://x/admin/reset-password');
    expect(html).toContain('cuenta AMES');
    expect(html).not.toContain('cuenta de Administrador');
  });
});

describe('EmailsService.sendAdminQuotationEmail (Story 6.8)', () => {
  const pdf = Buffer.from('%PDF-1.4');

  it('escapa nombreContacto en HTML (XSS correo)', async () => {
    const service = new EmailsService(makeConfig());
    const sendEmail = jest
      .spyOn(service as any, 'sendEmail')
      .mockResolvedValue(undefined);

    await service.sendAdminQuotationEmail(
      'a@x.com',
      `<img src=x onerror=alert(1)>`,
      'COT-2026-0001',
      pdf,
      'abc123',
      undefined,
      undefined,
      { emisorNombre: 'AMES Test', fechaVencimiento: new Date('2026-12-31') },
    );

    const html = sendEmail.mock.calls[0][2] as string;
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('usa emisor/vigencia reales sin literales MOC/30 días', async () => {
    const service = new EmailsService(makeConfig());
    const sendEmail = jest
      .spyOn(service as any, 'sendEmail')
      .mockResolvedValue(undefined);

    await service.sendAdminQuotationEmail(
      'a@x.com',
      'Ana',
      'COT-2026-0001',
      pdf,
      'tok',
      undefined,
      undefined,
      {
        emisorNombre: 'Clínica Demo SA',
        fechaVencimiento: new Date('2026-12-31T12:00:00.000Z'),
      },
    );

    const html = sendEmail.mock.calls[0][2] as string;
    expect(html).toContain('Clínica Demo SA');
    expect(html).not.toContain('Médica Ocupacional Caborca');
    expect(html).not.toContain('30 días');
    expect(html).toMatch(/válido hasta el /);
  });

  it('arma magic link normalizado y falla sin FRONTEND_URL', async () => {
    const service = new EmailsService(makeConfig());
    const sendEmail = jest
      .spyOn(service as any, 'sendEmail')
      .mockResolvedValue(undefined);

    await service.sendAdminQuotationEmail(
      'a@x.com',
      'Ana',
      'COT-1',
      pdf,
      'deadbeef',
    );

    const html = sendEmail.mock.calls[0][2] as string;
    expect(html).toContain(
      'http://localhost:5173/cotizacion-publica/deadbeef',
    );
    expect(html).not.toContain('undefined/cotizacion-publica');
    expect(html).not.toContain('//cotizacion-publica');

    const broken = new EmailsService(makeConfig({ FRONTEND_URL: undefined }));
    await expect(
      broken.sendAdminQuotationEmail('a@x.com', 'Ana', 'COT-1', pdf, 'tok'),
    ).rejects.toThrow(/FRONTEND_URL/);
  });

  it('pasa fromOverride al sendEmail', async () => {
    const service = new EmailsService(makeConfig());
    const sendEmail = jest
      .spyOn(service as any, 'sendEmail')
      .mockResolvedValue(undefined);

    await service.sendAdminQuotationEmail(
      ['a@x.com'],
      'Ana',
      'COT-1',
      pdf,
      undefined,
      'remitente@tenant.test',
      ['cc@x.com'],
    );

    expect(sendEmail).toHaveBeenCalledWith(
      ['a@x.com'],
      expect.stringContaining('COT-1'),
      expect.any(String),
      'from@ames.test',
      expect.arrayContaining([
        expect.objectContaining({ filename: 'Cotizacion_COT-1.pdf' }),
      ]),
      'remitente@tenant.test',
      ['cc@x.com'],
    );
  });

  it('formatVigencia omite Invalid Date', () => {
    const service = new EmailsService(makeConfig());
    const label = (service as any).formatVigencia(new Date('nope'));
    expect(label).toBe('');
  });
});

describe('EmailsService.sendInternalDecisionNotification (Story 6.13)', () => {
  it('escapa folio/solicitante y usa fromOverride sin BCC', async () => {
    const service = new EmailsService(makeConfig());
    const sendEmail = jest
      .spyOn(service as any, 'sendEmail')
      .mockResolvedValue(undefined);

    await service.sendInternalDecisionNotification({
      to: ['a@ames.test', 'b@ames.test'],
      folio: 'COT<script>',
      decision: 'aceptada',
      solicitanteLabel: '<Acme>',
      fromOverride: 'remitente@tenant.test',
    });

    expect(sendEmail).toHaveBeenCalledWith(
      ['a@ames.test', 'b@ames.test'],
      'Cotización COT<script> aceptada',
      expect.any(String),
      undefined,
      undefined,
      'remitente@tenant.test',
    );
    const html = sendEmail.mock.calls[0][2] as string;
    expect(html).toContain('COT&lt;script&gt;');
    expect(html).toContain('&lt;Acme&gt;');
    expect(html).toContain('aceptada');
    expect(html).not.toContain('<script>');
  });

  it('sanitiza CR/LF en subject y filtra emails inválidos', async () => {
    const service = new EmailsService(makeConfig());
    const sendEmail = jest
      .spyOn(service as any, 'sendEmail')
      .mockResolvedValue(undefined);

    await service.sendInternalDecisionNotification({
      to: ['ok@ames.test', 'no-es-email', ''],
      folio: 'COT-1\r\nBcc: evil@x.com',
      decision: 'rechazada',
      solicitanteLabel: 'X',
    });

    expect(sendEmail).toHaveBeenCalledWith(
      ['ok@ames.test'],
      'Cotización COT-1 Bcc: evil@x.com rechazada',
      expect.any(String),
      undefined,
      undefined,
      expect.any(String),
    );
  });

  it('sin destinatarios lanza', async () => {
    const service = new EmailsService(makeConfig());
    await expect(
      service.sendInternalDecisionNotification({
        to: [],
        folio: 'COT-1',
        decision: 'rechazada',
        solicitanteLabel: 'X',
      }),
    ).rejects.toThrow(/destinatario/);
  });
});

describe('quotationDecisionNotificationTemplate', () => {
  it('incluye folio y decisión', () => {
    const html = quotationDecisionNotificationTemplate({
      folio: 'COT-1',
      decisionLabel: 'rechazada',
      solicitanteLabel: 'Acme / Ana',
    });
    expect(html).toContain('COT-1');
    expect(html).toContain('rechazada');
    expect(html).toContain('Acme / Ana');
  });
});
