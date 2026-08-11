import {
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CategoriasServicioService } from './categorias-servicio.service';
import { TenantContextService } from '../tenants/tenant-context.service';
import { CreateCategoriaServicioDto } from './dto/create-categoria-servicio.dto';
import { FilterCategoriaServicioDto } from './dto/filter-categoria-servicio.dto';

const queryPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

describe('CategoriasServicioService (Story 5.1)', () => {
  const tenantId = new Types.ObjectId();
  const savedDocs: any[] = [];

  const categoriaModel: any = jest.fn().mockImplementation((data: any) => {
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

  categoriaModel.find = jest.fn();
  categoriaModel.findOne = jest.fn();
  categoriaModel.findOneAndUpdate = jest.fn();
  categoriaModel.countDocuments = jest.fn();

  const servicioModel: any = {
    countDocuments: jest.fn(),
  };

  const tenantContext = {
    getTenantId: jest.fn().mockReturnValue(tenantId),
  } as unknown as TenantContextService;

  const service = new CategoriasServicioService(
    categoriaModel as any,
    servicioModel as any,
    tenantContext,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    savedDocs.length = 0;
    (tenantContext.getTenantId as jest.Mock).mockReturnValue(tenantId);
    categoriaModel.mockClear();
  });

  it('create normaliza codigo a uppercase', async () => {
    categoriaModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    const created = await service.create({
      nombre: '  Médicos  ',
      codigo: 'med',
    });

    expect(created.nombre).toBe('Médicos');
    expect(created.codigo).toBe('MED');
    expect(created.tenantId).toEqual(tenantId);
    expect(created.activo).toBe(true);
  });

  it('create con codigo activo existente → ConflictException', async () => {
    categoriaModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        codigo: 'MED',
        activo: true,
      }),
    });

    await expect(
      service.create({ nombre: 'Médicos', codigo: 'med' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('create con codigo inactivo existente → reactiva (no duplica)', async () => {
    const doc = {
      _id: new Types.ObjectId(),
      codigo: 'MED',
      nombre: 'Viejo',
      activo: false,
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };
    categoriaModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });

    const res = await service.create({
      nombre: 'Médicos',
      codigo: 'med',
    });

    expect(res.activo).toBe(true);
    expect(res.nombre).toBe('Médicos');
    expect(doc.save).toHaveBeenCalled();
    expect(categoriaModel).not.toHaveBeenCalled();
  });

  it('create E11000 con código activo → ConflictException', async () => {
    categoriaModel.findOne
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          codigo: 'MED',
          activo: true,
        }),
      });
    categoriaModel.mockImplementationOnce((data: any) => ({
      ...data,
      _id: new Types.ObjectId(),
      save: jest.fn().mockRejectedValue({ code: 11000 }),
    }));

    await expect(
      service.create({ nombre: 'Médicos', codigo: 'med' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('create E11000 con código inactivo → reactiva', async () => {
    const raced = {
      _id: new Types.ObjectId(),
      codigo: 'MED',
      nombre: 'Viejo',
      activo: false,
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };
    categoriaModel.findOne
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(raced),
      });
    categoriaModel.mockImplementationOnce((data: any) => ({
      ...data,
      _id: new Types.ObjectId(),
      save: jest.fn().mockRejectedValue({ code: 11000 }),
    }));

    const res = await service.create({ nombre: 'Médicos', codigo: 'med' });

    expect(res.activo).toBe(true);
    expect(res.nombre).toBe('Médicos');
    expect(raced.save).toHaveBeenCalled();
  });

  it('update vacío → findOne (sin findOneAndUpdate)', async () => {
    const id = new Types.ObjectId().toString();
    const doc = { _id: new Types.ObjectId(id), nombre: 'Médicos', codigo: 'MED' };
    categoriaModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });

    const res = await service.update(id, {});

    expect(res).toEqual(doc);
    expect(categoriaModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('update ignora nombre/codigo null (no .trim 500)', async () => {
    const id = new Types.ObjectId().toString();
    const doc = { _id: new Types.ObjectId(id), nombre: 'Médicos', codigo: 'MED' };
    categoriaModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });

    const res = await service.update(id, {
      nombre: null as unknown as string,
      codigo: null as unknown as string,
    });

    expect(res).toEqual(doc);
    expect(categoriaModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('findAll tenant vacío → lista vacía (sin seed)', async () => {
    const execFind = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec: execFind });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    categoriaModel.find.mockReturnValue({ sort });
    categoriaModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    const res = await service.findAll();

    expect(categoriaModel.find).toHaveBeenCalledWith({
      tenantId,
      activo: { $ne: false },
    });
    expect(res.data).toEqual([]);
    expect(res.total).toBe(0);
  });

  it('findAll({ activo: false }) solo inactivas', async () => {
    const execFind = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec: execFind });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    categoriaModel.find.mockReturnValue({ sort });
    categoriaModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    await service.findAll({ activo: false });

    expect(categoriaModel.find).toHaveBeenCalledWith({
      tenantId,
      activo: false,
    });
  });

  it('remove soft-delete OK cuando count ítems activos = 0', async () => {
    const id = new Types.ObjectId().toString();
    const catId = new Types.ObjectId(id);
    categoriaModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: catId, tenantId }),
    });
    servicioModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });
    const deactivated = { _id: catId, activo: false, tenantId };
    categoriaModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(deactivated),
    });

    const res = await service.remove(id);

    expect(servicioModel.countDocuments).toHaveBeenCalledWith({
      tenantId,
      categoriaId: catId,
      activo: { $ne: false },
    });
    expect(categoriaModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, tenantId },
      { $set: { activo: false } },
      { new: true },
    );
    expect(res.activo).toBe(false);
  });

  it('remove blocked cuando hay ítems activos (count > 0)', async () => {
    const id = new Types.ObjectId().toString();
    const catId = new Types.ObjectId(id);
    categoriaModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: catId, tenantId }),
    });
    servicioModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(2),
    });

    await expect(service.remove(id)).rejects.toBeInstanceOf(ConflictException);
    expect(categoriaModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('findOne inexistente → NotFound', async () => {
    const id = new Types.ObjectId().toString();
    categoriaModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.findOne(id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('CreateCategoriaServicioDto rechaza codigo con length ≠ 2–3', () => {
    const tooShort = plainToInstance(CreateCategoriaServicioDto, {
      nombre: 'X',
      codigo: 'A',
    });
    expect(
      validateSync(tooShort).some((e) => e.property === 'codigo'),
    ).toBe(true);

    const tooLong = plainToInstance(CreateCategoriaServicioDto, {
      nombre: 'X',
      codigo: 'ABCD',
    });
    expect(
      validateSync(tooLong).some((e) => e.property === 'codigo'),
    ).toBe(true);
  });

  it('CreateCategoriaServicioDto rechaza codigo no alfanumérico', () => {
    const dto = plainToInstance(CreateCategoriaServicioDto, {
      nombre: 'X',
      codigo: 'M-',
    });
    expect(validateSync(dto).some((e) => e.property === 'codigo')).toBe(true);
  });

  it('CreateCategoriaServicioDto acepta codigo 2–3 alfanumérico', () => {
    const dto = plainToInstance(CreateCategoriaServicioDto, {
      nombre: 'Médicos',
      codigo: 'med',
    });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('FilterCategoriaServicioDto ValidationPipe: activo=false', async () => {
    const dto = (await queryPipe().transform(
      { activo: 'false', page: '1', limit: '20' },
      { type: 'query', metatype: FilterCategoriaServicioDto, data: '' },
    )) as FilterCategoriaServicioDto;
    expect(dto.activo).toBe(false);
  });
});
