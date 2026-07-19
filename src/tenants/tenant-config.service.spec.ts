import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { TenantConfigService } from './tenant-config.service';

describe('TenantConfigService (Stories 2.1–2.5)', () => {
  const tenantId = new Types.ObjectId();
  const otherTenantId = new Types.ObjectId();

  const store = new Map<string, any>();

  function makeDoc(tid: Types.ObjectId, branding: Record<string, unknown> = {}) {
    return {
      _id: new Types.ObjectId(),
      tenantId: tid,
      branding: { ...branding },
      bancarios: {},
      vigenciaDefaultDias: 30,
      correosNotificacion: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      toObject() {
        return {
          ...this,
          branding: { ...this.branding },
          bancarios: { ...(this.bancarios || {}) },
        };
      },
    };
  }

  const tenantConfigModel = {
    findOne: jest.fn((q: { tenantId: Types.ObjectId }) => ({
      exec: async () => store.get(String(q.tenantId)) || null,
    })),
    findOneAndUpdate: jest.fn(
      (
        filter: { tenantId: Types.ObjectId },
        update: any,
        _opts: unknown,
      ) => ({
        exec: async () => {
          const key = String(filter.tenantId);
          let doc = store.get(key);
          if (!doc) {
            const insert = update?.$setOnInsert || { tenantId: filter.tenantId };
            doc = makeDoc(filter.tenantId, insert.branding || {});
            if (insert.vigenciaDefaultDias != null) {
              doc.vigenciaDefaultDias = insert.vigenciaDefaultDias;
            }
            if (insert.bancarios) doc.bancarios = { ...insert.bancarios };
            if (insert.correosNotificacion) {
              doc.correosNotificacion = [...insert.correosNotificacion];
            }
            store.set(key, doc);
          }
          if (update?.$set) {
            for (const [path, val] of Object.entries(update.$set)) {
              if (path.startsWith('branding.')) {
                const field = path.slice('branding.'.length);
                doc.branding = doc.branding || {};
                doc.branding[field] = val;
              } else if (path.startsWith('bancarios.')) {
                const field = path.slice('bancarios.'.length);
                doc.bancarios = doc.bancarios || {};
                doc.bancarios[field] = val;
              } else {
                doc[path] = val;
              }
            }
          }
          if (update?.$unset) {
            for (const path of Object.keys(update.$unset)) {
              if (path.startsWith('branding.')) {
                const field = path.slice('branding.'.length);
                if (doc.branding) delete doc.branding[field];
              } else if (path.startsWith('bancarios.')) {
                const field = path.slice('bancarios.'.length);
                if (doc.bancarios) delete doc.bancarios[field];
              } else {
                delete doc[path];
              }
            }
          }
          return doc;
        },
      }),
    ),
  };

  const tenantContext = {
    getTenantId: jest.fn(() => tenantId),
  };

  let service: TenantConfigService;

  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
    service = new TenantConfigService(
      tenantConfigModel as any,
      tenantContext as any,
    );
  });

  it('findOrCreateForTenant crea shell vía upsert si no existe', async () => {
    const doc = await service.findOrCreateForTenant(tenantId);
    expect(doc.tenantId).toEqual(tenantId);
    expect(tenantConfigModel.findOneAndUpdate).toHaveBeenCalledWith(
      { tenantId },
      {
        $setOnInsert: {
          tenantId,
          branding: {},
          correosNotificacion: [],
          vigenciaDefaultDias: 30,
          bancarios: {},
        },
      },
      { upsert: true, new: true },
    );
  });

  it('findOrCreateForTenant es idempotente (segundo call no duplica)', async () => {
    await service.findOrCreateForTenant(tenantId);
    await service.findOrCreateForTenant(tenantId);
    expect(store.size).toBe(1);
    expect(tenantConfigModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('getForRequest usa tenant del contexto (AD-2)', async () => {
    const doc = await service.getForRequest();
    expect(tenantContext.getTenantId).toHaveBeenCalled();
    expect(doc.tenantId).toEqual(tenantId);
  });

  it('findOrCreate scoped por tenantId (no mezcla tenants)', async () => {
    const a = await service.findOrCreateForTenant(tenantId);
    const b = await service.findOrCreateForTenant(otherTenantId);
    expect(String(a.tenantId)).not.toEqual(String(b.tenantId));
    expect(store.size).toBe(2);
  });

  it('toResponse serializa ids, fechas ISO y branding', () => {
    const doc = makeDoc(tenantId, {
      razonSocial: 'AMES QRO',
      logoUrl: '/uploads/tenant-logos/x.png',
    }) as any;
    const res = service.toResponse(doc);
    expect(res._id).toBe(String(doc._id));
    expect(res.tenantId).toBe(String(tenantId));
    expect(res.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(res.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(res.branding?.razonSocial).toBe('AMES QRO');
    expect(res.branding?.logoUrl).toBe('/uploads/tenant-logos/x.png');
  });

  it('findOrCreate recupera doc tras E11000 de carrera', async () => {
    const existing = makeDoc(tenantId);
    store.set(String(tenantId), existing);
    tenantConfigModel.findOneAndUpdate.mockReturnValueOnce({
      exec: async () => {
        const err: any = new Error('E11000 duplicate');
        err.code = 11000;
        throw err;
      },
    });

    const doc = await service.findOrCreateForTenant(tenantId);
    expect(doc).toBe(existing);
  });

  it('updateBranding aplica $set solo en tenant del contexto', async () => {
    await service.findOrCreateForTenant(tenantId);
    const updated = await service.updateBranding({
      razonSocial: 'AMES Los Mochis',
      rfc: 'aaa010101aaa',
    });
    expect(updated.branding.razonSocial).toBe('AMES Los Mochis');
    expect(updated.branding.rfc).toBe('aaa010101aaa');
    expect(tenantContext.getTenantId).toHaveBeenCalled();
  });

  it('updateBranding con string vacío limpia campo ($unset)', async () => {
    store.set(
      String(tenantId),
      makeDoc(tenantId, { razonSocial: 'Temp', telefono: '123' }),
    );
    const updated = await service.updateBranding({ razonSocial: '' });
    expect(updated.branding.razonSocial).toBeUndefined();
    expect(updated.branding.telefono).toBe('123');
  });

  it('updateBranding con null limpia campo ($unset)', async () => {
    store.set(
      String(tenantId),
      makeDoc(tenantId, { emailContacto: 'a@b.com' }),
    );
    const updated = await service.updateBranding({
      emailContacto: null as any,
    });
    expect(updated.branding.emailContacto).toBeUndefined();
  });

  it('saveLogo rechaza mime inválido', async () => {
    await expect(
      service.saveLogo({
        buffer: Buffer.from('x'),
        size: 10,
        mimetype: 'application/pdf',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('saveLogo acepta image/jpg (alias) y mime con parámetros', async () => {
    // Evitar escribir en disco real: mock interno vía spy de write
    const writeSpy = jest
      .spyOn(require('fs'), 'writeFileSync')
      .mockImplementation(() => undefined);
    const existsSpy = jest
      .spyOn(require('fs'), 'existsSync')
      .mockReturnValue(false);
    const mkdirSpy = jest
      .spyOn(require('fs'), 'mkdirSync')
      .mockImplementation(() => undefined as any);

    try {
      await service.findOrCreateForTenant(tenantId);
      const updated = await service.saveLogo({
        buffer: Buffer.from('fake'),
        size: 4,
        mimetype: 'Image/JPG; charset=binary',
      } as any);
      expect(updated.branding.logoUrl).toMatch(/\.jpg$/);
      expect(writeSpy).toHaveBeenCalled();
    } finally {
      writeSpy.mockRestore();
      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
    }
  });

  it('saveLogo rechaza archivo vacío', async () => {
    await expect(
      service.saveLogo({
        buffer: Buffer.alloc(0),
        size: 0,
        mimetype: 'image/png',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('saveBankLogo setea bancarios.logoUrl sin pisar branding.logoUrl', async () => {
    const writeSpy = jest
      .spyOn(require('fs'), 'writeFileSync')
      .mockImplementation(() => undefined);
    const existsSpy = jest
      .spyOn(require('fs'), 'existsSync')
      .mockReturnValue(false);
    const mkdirSpy = jest
      .spyOn(require('fs'), 'mkdirSync')
      .mockImplementation(() => undefined as any);

    try {
      const existing = makeDoc(tenantId, {
        logoUrl: '/uploads/tenant-logos/brand.png',
      });
      store.set(String(tenantId), existing);
      const updated = await service.saveBankLogo({
        buffer: Buffer.from('fake'),
        size: 4,
        mimetype: 'image/png',
      } as any);
      expect(updated.bancarios?.logoUrl).toMatch(
        /\/uploads\/tenant-bank-logos\//,
      );
      expect(updated.branding?.logoUrl).toBe('/uploads/tenant-logos/brand.png');
      const resp = service.toResponse(updated as any);
      expect(resp.bancarios?.logoUrl).toMatch(/tenant-bank-logos/);
      expect(resp.branding?.logoUrl).toBe('/uploads/tenant-logos/brand.png');
    } finally {
      writeSpy.mockRestore();
      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
    }
  });

  it('updateVigenciaBancarios con bancarios null limpia disco de logo banco', async () => {
    const doc = makeDoc(tenantId);
    doc.bancarios = {
      logoUrl: '/uploads/tenant-bank-logos/x.png',
      banco: 'BBVA',
    };
    store.set(String(tenantId), doc);
    const existsSpy = jest
      .spyOn(require('fs'), 'existsSync')
      .mockReturnValue(true);
    const unlinkSpy = jest
      .spyOn(require('fs'), 'unlinkSync')
      .mockImplementation(() => undefined);
    try {
      const updated = await service.updateVigenciaBancarios({
        bancarios: null as any,
      });
      expect(updated.bancarios).toBeUndefined();
      expect(unlinkSpy).toHaveBeenCalled();
    } finally {
      existsSpy.mockRestore();
      unlinkSpy.mockRestore();
    }
  });

  it('saveBankLogo rechaza mime inválido', async () => {
    await expect(
      service.saveBankLogo({
        buffer: Buffer.from('x'),
        size: 10,
        mimetype: 'text/plain',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clearBankLogo limpia bancarios.logoUrl', async () => {
    const doc = makeDoc(tenantId);
    doc.bancarios = {
      logoUrl: '/uploads/tenant-bank-logos/x.png',
      banco: 'BBVA',
    };
    store.set(String(tenantId), doc);
    const existsSpy = jest
      .spyOn(require('fs'), 'existsSync')
      .mockReturnValue(false);
    try {
      const updated = await service.clearBankLogo();
      expect(updated.bancarios?.logoUrl).toBeUndefined();
      expect(updated.bancarios?.banco).toBe('BBVA');
    } finally {
      existsSpy.mockRestore();
    }
  });

  it('updateVigenciaBancarios no borra logoUrl al guardar textos', async () => {
    const doc = makeDoc(tenantId);
    doc.bancarios = {
      logoUrl: '/uploads/tenant-bank-logos/x.png',
      banco: 'Old',
    };
    store.set(String(tenantId), doc);
    const updated = await service.updateVigenciaBancarios({
      bancarios: { banco: 'Nuevo' },
    });
    expect(updated.bancarios?.banco).toBe('Nuevo');
    expect(updated.bancarios?.logoUrl).toBe(
      '/uploads/tenant-bank-logos/x.png',
    );
  });

  it('updateEmailConfig guarda remitente y lista scoped al tenant', async () => {
    await service.findOrCreateForTenant(tenantId);
    const updated = await service.updateEmailConfig({
      emailRemitente: 'qro@ames.example',
      correosNotificacion: ['a@ames.example', 'A@ames.example', 'b@ames.example'],
    });
    expect(updated.emailRemitente).toBe('qro@ames.example');
    expect(updated.correosNotificacion).toEqual([
      'a@ames.example',
      'b@ames.example',
    ]);
  });
  it('updateEmailConfig acepta lista vacía', async () => {
    store.set(String(tenantId), {
      ...makeDoc(tenantId),
      correosNotificacion: ['x@y.com'],
    });
    const updated = await service.updateEmailConfig({
      correosNotificacion: [],
    });
    expect(updated.correosNotificacion).toEqual([]);
  });

  it('updateEmailConfig con emailRemitente vacío hace $unset', async () => {
    store.set(String(tenantId), {
      ...makeDoc(tenantId),
      emailRemitente: 'old@ames.example',
    });
    const updated = await service.updateEmailConfig({ emailRemitente: '' });
    expect(updated.emailRemitente).toBeUndefined();
  });

  it('updateEmailConfig null en lista persiste []', async () => {
    store.set(String(tenantId), {
      ...makeDoc(tenantId),
      correosNotificacion: ['x@y.com'],
    });
    const updated = await service.updateEmailConfig({
      correosNotificacion: null as any,
    });
    expect(updated.correosNotificacion).toEqual([]);
  });

  it('updateEmailConfig rechaza ítems no-string', async () => {
    await expect(
      service.updateEmailConfig({
        correosNotificacion: ['a@b.com', 123 as any],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('toResponse incluye emailRemitente y correosNotificacion []', () => {
    const doc = {
      ...makeDoc(tenantId),
      emailRemitente: 'from@ames.example',
    } as any;
    const res = service.toResponse(doc);
    expect(res.emailRemitente).toBe('from@ames.example');
    expect(res.correosNotificacion).toEqual([]);
  });

  it('updateVigenciaBancarios guarda días y bancarios scoped', async () => {
    await service.findOrCreateForTenant(tenantId);
    const updated = await service.updateVigenciaBancarios({
      vigenciaDefaultDias: 45,
      bancarios: {
        titular: 'AMES QRO',
        banco: 'BBVA',
        cuenta: '123',
        clabe: '012345678901234567',
      },
    });
    expect(updated.vigenciaDefaultDias).toBe(45);
    expect(updated.bancarios.banco).toBe('BBVA');
    expect(updated.bancarios.clabe).toBe('012345678901234567');
  });

  it('updateVigenciaBancarios acepta bancarios vacíos (limpia campos)', async () => {
    store.set(String(tenantId), {
      ...makeDoc(tenantId),
      bancarios: { banco: 'BBVA', cuenta: '1' },
      vigenciaDefaultDias: 30,
    });
    const updated = await service.updateVigenciaBancarios({
      bancarios: { banco: '', cuenta: '' },
    });
    expect(updated.bancarios.banco).toBeUndefined();
    expect(updated.bancarios.cuenta).toBeUndefined();
  });

  it('updateVigenciaBancarios con bancarios null limpia el subdocumento', async () => {
    store.set(String(tenantId), {
      ...makeDoc(tenantId),
      bancarios: { banco: 'BBVA', cuenta: '1', clabe: '012' },
      vigenciaDefaultDias: 30,
    });
    const updated = await service.updateVigenciaBancarios({
      bancarios: null as any,
    });
    expect(updated.bancarios).toBeUndefined();
  });

  it('toResponse incluye vigenciaDefaultDias y bancarios', () => {
    const doc = {
      ...makeDoc(tenantId),
      vigenciaDefaultDias: 60,
      bancarios: { banco: 'Banorte', clabe: '111' },
    } as any;
    const res = service.toResponse(doc);
    expect(res.vigenciaDefaultDias).toBe(60);
    expect(res.bancarios?.banco).toBe('Banorte');
    expect(res.bancarios?.clabe).toBe('111');
  });
});
