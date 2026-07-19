import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ContactosService } from './contactos.service';
import { ClientesService } from './clientes.service';
import { TenantContextService } from '../tenants/tenant-context.service';

describe('ContactosService (Story 3.3)', () => {
  const tenantId = new Types.ObjectId();
  const clienteId = new Types.ObjectId();
  const otherClienteId = new Types.ObjectId();

  const savedDocs: any[] = [];

  const contactoModel: any = jest.fn().mockImplementation((data: any) => {
    const doc = {
      ...data,
      _id: new Types.ObjectId(),
      save: jest.fn().mockImplementation(async function (this: any) {
        savedDocs.push(this);
        return this;
      }),
    };
    return doc;
  });

  contactoModel.find = jest.fn();
  contactoModel.findOne = jest.fn();
  contactoModel.findOneAndUpdate = jest.fn();
  contactoModel.countDocuments = jest.fn();

  const clientesService = {
    findOne: jest.fn(),
  } as unknown as ClientesService;

  const tenantContext = {
    getTenantId: jest.fn().mockReturnValue(tenantId),
  } as unknown as TenantContextService;

  const service = new ContactosService(
    contactoModel as any,
    clientesService,
    tenantContext,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    savedDocs.length = 0;
    (tenantContext.getTenantId as jest.Mock).mockReturnValue(tenantId);
    (clientesService.findOne as jest.Mock).mockResolvedValue({
      _id: clienteId,
      tenantId,
      activo: true,
      empresa: 'Acme',
    });
    contactoModel.mockClear();
  });

  it('create solo con nombre', async () => {
    const created = await service.create(clienteId.toString(), {
      nombre: '  María López  ',
    });
    expect(created.nombre).toBe('María López');
    expect(created.activo).toBe(true);
    expect(clientesService.findOne).toHaveBeenCalledWith(clienteId.toString());
  });

  it('create con correo normalizado', async () => {
    const created = await service.create(clienteId.toString(), {
      nombre: 'Ana',
      correo: '  Ana@Empresa.COM  ',
    } as any);
    expect(created.correo).toBe('ana@empresa.com');
  });

  it('create rechaza cliente inactivo', async () => {
    (clientesService.findOne as jest.Mock).mockResolvedValue({
      _id: clienteId,
      activo: false,
    });
    await expect(
      service.create(clienteId.toString(), { nombre: 'X' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create rechaza nombre vacío', async () => {
    await expect(
      service.create(clienteId.toString(), { nombre: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findAll default solo activos scoped', async () => {
    const execFind = jest.fn().mockResolvedValue([{ nombre: 'A' }]);
    const limit = jest.fn().mockReturnValue({ exec: execFind });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    contactoModel.find.mockReturnValue({ sort });
    contactoModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });

    const res = await service.findAll(clienteId.toString(), {
      page: 1,
      limit: 20,
    });

    expect(contactoModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        clienteId,
        activo: { $ne: false },
      }),
    );
    expect(res.data).toHaveLength(1);
    expect(res.total).toBe(1);
  });

  it('findAll activo=false lista inactivos', async () => {
    const execFind = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec: execFind });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    contactoModel.find.mockReturnValue({ sort });
    contactoModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    await service.findAll(clienteId.toString(), { activo: false });

    expect(contactoModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ activo: false }),
    );
  });

  it('cliente inexistente → NotFound (via clientesService)', async () => {
    (clientesService.findOne as jest.Mock).mockRejectedValue(
      new NotFoundException('Cliente no encontrado'),
    );
    await expect(
      service.findAll(otherClienteId.toString()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove soft-delete pone activo=false', async () => {
    const id = new Types.ObjectId().toString();
    const updated = { _id: id, activo: false, tenantId, clienteId };
    contactoModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(updated),
    });
    const res = await service.remove(clienteId.toString(), id);
    expect(res.activo).toBe(false);
    expect(contactoModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: id,
        tenantId,
        clienteId,
      }),
      { $set: { activo: false } },
      { new: true },
    );
  });

  it('toggleActivo reactiva false→true', async () => {
    const id = new Types.ObjectId().toString();
    const doc = {
      _id: id,
      activo: false,
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };
    contactoModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });
    const res = await service.toggleActivo(clienteId.toString(), id);
    expect(res.activo).toBe(true);
  });

  it('toggleActivo con activo ausente desactiva (trata como activo)', async () => {
    const id = new Types.ObjectId().toString();
    const doc = {
      _id: id,
      activo: undefined,
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };
    contactoModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });
    const res = await service.toggleActivo(clienteId.toString(), id);
    expect(res.activo).toBe(false);
  });

  it('update con correo vacío hace $unset', async () => {
    const id = new Types.ObjectId().toString();
    contactoModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: id,
        nombre: 'Ana',
        activo: true,
      }),
    });
    await service.update(clienteId.toString(), id, { correo: '' });
    expect(contactoModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: id, tenantId, clienteId }),
      expect.objectContaining({ $unset: { correo: 1 } }),
      { new: true },
    );
  });

  it('findOne contacto de otro cliente → NotFound', async () => {
    contactoModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.findOne(
        clienteId.toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(contactoModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        clienteId,
      }),
    );
  });
});
