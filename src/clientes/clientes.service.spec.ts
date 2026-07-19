import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ClientesService } from './clientes.service';
import { TenantContextService } from '../tenants/tenant-context.service';

describe('ClientesService (Stories 3.1–3.2)', () => {
  const tenantId = new Types.ObjectId();
  const otherTenantId = new Types.ObjectId();

  const savedDocs: any[] = [];

  const clienteModel: any = jest.fn().mockImplementation((data: any) => {
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

  clienteModel.find = jest.fn();
  clienteModel.findOne = jest.fn();
  clienteModel.findOneAndUpdate = jest.fn();
  clienteModel.countDocuments = jest.fn();

  const tenantContext = {
    getTenantId: jest.fn().mockReturnValue(tenantId),
  } as unknown as TenantContextService;

  const service = new ClientesService(clienteModel as any, tenantContext);

  beforeEach(() => {
    jest.clearAllMocks();
    savedDocs.length = 0;
    (tenantContext.getTenantId as jest.Mock).mockReturnValue(tenantId);
    clienteModel.mockClear();
  });

  it('findAll default solo activos + paginado scoped', async () => {
    const execFind = jest.fn().mockResolvedValue([{ empresa: 'A' }]);
    const limit = jest.fn().mockReturnValue({ exec: execFind });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    clienteModel.find.mockReturnValue({ sort });
    clienteModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });

    const res = await service.findAll({ page: 1, limit: 20 });

    expect(clienteModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        activo: { $ne: false },
      }),
    );
    expect(res.data).toHaveLength(1);
    expect(res.total).toBe(1);
    expect(res.page).toBe(1);
    expect(res.limit).toBe(20);
  });

  it('findAll activo=false lista inactivos', async () => {
    const execFind = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec: execFind });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    clienteModel.find.mockReturnValue({ sort });
    clienteModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    await service.findAll({ activo: false });

    expect(clienteModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, activo: false }),
    );
  });

  it('findAll escapa metacaracteres regex', async () => {
    const execFind = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec: execFind });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    clienteModel.find.mockReturnValue({ sort });
    clienteModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    await service.findAll({ empresa: 'Acme (SA)' });

    expect(clienteModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        empresa: { $regex: 'Acme \\(SA\\)', $options: 'i' },
      }),
    );
  });

  it('findOne cross-tenant: NotFound', async () => {
    clienteModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.findOne(new Types.ObjectId().toString()),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tenantId).not.toEqual(otherTenantId);
  });

  it('create solo con empresa', async () => {
    const created = await service.create({ empresa: '  Acme SA  ' });
    expect(created.empresa).toBe('Acme SA');
    expect(created.activo).toBe(true);
  });

  it('create RFC duplicado → ConflictException', async () => {
    clienteModel.mockImplementationOnce((data: any) => ({
      ...data,
      save: jest.fn().mockRejectedValue({ code: 11000 }),
    }));
    await expect(
      service.create({ empresa: 'X', rfc: 'AAA010101AAA' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('remove soft-delete pone activo=false', async () => {
    const id = new Types.ObjectId().toString();
    const updated = { _id: id, activo: false, tenantId };
    clienteModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(updated),
    });
    const res = await service.remove(id);
    expect(res.activo).toBe(false);
    expect(clienteModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, tenantId },
      { $set: { activo: false } },
      { new: true },
    );
  });

  it('toggleActivo invierte estado', async () => {
    const id = new Types.ObjectId().toString();
    const doc = {
      _id: id,
      activo: true,
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };
    clienteModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });
    const res = await service.toggleActivo(id);
    expect(res.activo).toBe(false);
    expect(doc.save).toHaveBeenCalled();
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
    clienteModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });
    const res = await service.toggleActivo(id);
    expect(res.activo).toBe(true);
  });

  it('toggleActivo E11000 al reactivar → ConflictException', async () => {
    const id = new Types.ObjectId().toString();
    const doc = {
      _id: id,
      activo: false,
      save: jest.fn().mockRejectedValue({ code: 11000 }),
    };
    clienteModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });
    await expect(service.toggleActivo(id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('create rechaza empresa vacía', async () => {
    await expect(service.create({ empresa: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
