import { Test, TestingModule } from '@nestjs/testing';
import { CotizacionesService } from './cotizaciones.service';
import { getModelToken } from '@nestjs/mongoose';
import { Cotizacion } from './schemas/cotizacion.schema';
import { OrdenTrabajo } from '../ordenes-trabajo/schemas/orden-trabajo.schema';
import { ClientesService } from '../clientes/clientes.service';
import { ServiciosService } from '../servicios/servicios.service';
import { SedesService } from '../sedes/sedes.service';
import { EmailService } from './services/email.service';
import { PdfService } from './services/pdf.service';
import { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

describe('CotizacionesService (WhatsApp Integration)', () => {
  let service: CotizacionesService;
  let whatsappService: WhatsappService;

  const mockCotizacion = {
    _id: 'mock-id',
    folio: 'COT-2026-0001',
    total: 1000,
    moneda: 'MXN',
    estado: 'vigente',
    fechaVencimiento: new Date(Date.now() + 100000), // Futuro
    clienteId: { empresa: 'Compañía Test' },
    items: [{ cantidad: 1 }],
    toObject: jest.fn().mockReturnValue({}),
  };

  const mockWhatsappService = {
    sendCotizacionAceptadaNotification: jest.fn().mockResolvedValue({ success: true }),
  };

  const mockOrdenesTrabajoService = {
    createFromCotizacion: jest.fn().mockResolvedValue({}),
  };

  const mockCotizacionModel = {
    findById: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockCotizacion),
      toObject: jest.fn().mockReturnValue(mockCotizacion),
    }),
    findOne: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockCotizacion),
    }),
    findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCotizacion),
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CotizacionesService,
        { provide: getModelToken(Cotizacion.name), useValue: mockCotizacionModel },
        { provide: getModelToken(OrdenTrabajo.name), useValue: {} },
        { provide: ClientesService, useValue: { findOne: jest.fn().mockResolvedValue({ empresa: 'Compañía Test' }) } },
        { provide: ServiciosService, useValue: {} },
        { provide: SedesService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: PdfService, useValue: {} },
        { provide: OrdenesTrabajoService, useValue: mockOrdenesTrabajoService },
        { provide: WhatsappService, useValue: mockWhatsappService },
      ],
    }).compile();

    service = module.get<CotizacionesService>(CotizacionesService);
    whatsappService = module.get<WhatsappService>(WhatsappService);

    // Mock findOne para evitar lógica compleja de agregación en pruebas unitarias simples
    jest.spyOn(service, 'findOne').mockResolvedValue(mockCotizacion as any);
    // Mock findOneByUsuarioClienteId para evitar más dependencias
    jest.spyOn(service as any, 'findOneByUsuarioClienteId').mockResolvedValue(mockCotizacion);
    // Mock findOneByMagicToken
    jest.spyOn(service, 'findOneByMagicToken').mockResolvedValue(mockCotizacion as any);
  });

  it('debe llamar a WhatsApp al aceptar como cliente', async () => {
    await service.aceptarCotizacion('id', 'user', 'client', [{ nombre: 'worker' }]);
    
    expect(whatsappService.sendCotizacionAceptadaNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        folio: mockCotizacion.folio,
        clienteNombre: 'Compañía Test',
        total: mockCotizacion.total,
      })
    );
  });

  it('debe crear la Orden de Trabajo ANTES de enviar la notificación de WhatsApp', async () => {
    const otSpy = jest.spyOn(mockOrdenesTrabajoService, 'createFromCotizacion');
    const waSpy = jest.spyOn(whatsappService, 'sendCotizacionAceptadaNotification');

    await service.aceptarCotizacion('id', 'user', 'client', [{ nombre: 'worker' }]);

    // Verificar orden de ejecución
    const otOrder = otSpy.mock.invocationCallOrder[0];
    const waOrder = waSpy.mock.invocationCallOrder[0];
    
    expect(otOrder).toBeLessThan(waOrder);
  });

  it('NO debe llamar a WhatsApp al aceptar como admin', async () => {
    await service.aceptarCotizacionAdmin('id', [{ nombre: 'worker' }]);
    
    expect(whatsappService.sendCotizacionAceptadaNotification).not.toHaveBeenCalled();
  });

  it('debe llamar a WhatsApp al aceptar por Magic Token', async () => {
    await service.aceptarCotizacionByMagicToken('token', [{ nombre: 'worker' }]);
    
    expect(whatsappService.sendCotizacionAceptadaNotification).toHaveBeenCalled();
  });

  it('NO debe romper el flujo si WhatsappService falla', async () => {
    mockWhatsappService.sendCotizacionAceptadaNotification.mockResolvedValueOnce({ 
      success: false, 
      error: 'API Error' 
    });

    const result = await service.aceptarCotizacion('id', 'user', 'client', [{ nombre: 'worker' }]);
    
    // El flujo principal debe continuar exitosamente
    expect(result).toBeDefined();
    expect(whatsappService.sendCotizacionAceptadaNotification).toHaveBeenCalled();
  });

  it('NO debe romper el flujo si WhatsappService lanza una excepción', async () => {
    mockWhatsappService.sendCotizacionAceptadaNotification.mockRejectedValueOnce(
        new Error('Network Failure')
    );

    const result = await service.aceptarCotizacion('id', 'user', 'client', [{ nombre: 'worker' }]);
    
    expect(result).toBeDefined();
    expect(whatsappService.sendCotizacionAceptadaNotification).toHaveBeenCalled();
  });
});
