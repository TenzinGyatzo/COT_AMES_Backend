import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ServiciosService } from './servicios.service';
import { TenantContextService } from '../tenants/tenant-context.service';
import { TenantsService } from '../tenants/tenants.service';
import { CategoriaServicio } from './enums/categoria-servicio.enum';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { FilterServicioDto } from './dto/filter-servicio.dto';

const queryPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

describe('ServiciosService (Stories 4.1 / 4.2 / 4.3 / 4.4)', () => {
  const tenantId = new Types.ObjectId();
  const otherTenantId = new Types.ObjectId();
  const savedDocs: any[] = [];

  const servicioModel: any = jest.fn().mockImplementation((data: any) => {
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

  servicioModel.find = jest.fn();
  servicioModel.findOne = jest.fn();
  servicioModel.findOneAndUpdate = jest.fn();
  servicioModel.findOneAndDelete = jest.fn();
  servicioModel.countDocuments = jest.fn();
  servicioModel.deleteOne = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  });
  servicioModel.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });

  const tenantContext = {
    getTenantId: jest.fn().mockReturnValue(tenantId),
  } as unknown as TenantContextService;

  const tenantsService = {
    findById: jest.fn(),
  } as unknown as TenantsService;

  const service = new ServiciosService(
    servicioModel as any,
    tenantContext,
    tenantsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    savedDocs.length = 0;
    (tenantContext.getTenantId as jest.Mock).mockReturnValue(tenantId);
    servicioModel.mockClear();
    servicioModel.updateMany.mockResolvedValue({ modifiedCount: 0 });
    (tenantsService.findById as jest.Mock).mockReset();
  });

  it('create asocia tenantId del contexto + categoria + MXN', async () => {
    const created = await service.create({
      nombre: '  Examen médico  ',
      precioUnitario: 500,
      categoria: CategoriaServicio.MED,
      moneda: 'USD',
    });

    expect(created.nombre).toBe('Examen médico');
    expect(created.categoria).toBe(CategoriaServicio.MED);
    expect(created.moneda).toBe('MXN');
    expect(created.tenantId).toEqual(tenantId);
    expect(created.activo).toBe(true);
  });

  it('create con descripción opcional vacía no la persiste', async () => {
    const created = await service.create({
      nombre: 'Capacitación',
      precioUnitario: 100,
      categoria: CategoriaServicio.CAP,
      descripcion: '   ',
    });

    expect(created.descripcion).toBeUndefined();
  });

  it('create propaga ForbiddenException de tenant', async () => {
    (tenantContext.getTenantId as jest.Mock).mockImplementation(() => {
      throw new ForbiddenException('Contexto de tenant no resuelto');
    });

    await expect(
      service.create({
        nombre: 'X',
        precioUnitario: 1,
        categoria: CategoriaServicio.OTR,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('CreateServicioDto rechaza categoría inválida', () => {
    const dto = plainToInstance(CreateServicioDto, {
      nombre: 'Servicio',
      precioUnitario: 10,
      categoria: 'INVALIDA',
    });
    const errors = validateSync(dto);
    expect(errors.some((e) => e.property === 'categoria')).toBe(true);
  });

  it('FilterServicioDto Transform: query string "false" → boolean false', () => {
    const dto = plainToInstance(FilterServicioDto, { activo: 'false' });
    expect(dto.activo).toBe(false);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('FilterServicioDto Transform: query string "true" → boolean true', () => {
    const dto = plainToInstance(FilterServicioDto, { activo: 'true' });
    expect(dto.activo).toBe(true);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('FilterServicioDto ValidationPipe: activo=false no se convierte a true (Story 4.5)', async () => {
    const dto = (await queryPipe().transform(
      { activo: 'false', page: '1', limit: '20' },
      { type: 'query', metatype: FilterServicioDto, data: '' },
    )) as FilterServicioDto;
    expect(dto.activo).toBe(false);
  });

  it('FilterServicioDto ValidationPipe: omitido → undefined', async () => {
    const dto = (await queryPipe().transform(
      { page: '1' },
      { type: 'query', metatype: FilterServicioDto, data: '' },
    )) as FilterServicioDto;
    expect(dto.activo).toBeUndefined();
  });

  it('FilterServicioDto ValidationPipe: objeto anidado → 400', async () => {
    await expect(
      queryPipe().transform(
        { activo: { foo: 'false' } },
        { type: 'query', metatype: FilterServicioDto, data: '' },
      ),
    ).rejects.toBeTruthy();
  });

  it('update cambia campos, fuerza MXN y $unset descripción vacía', async () => {
    const id = new Types.ObjectId().toString();
    const updated = {
      _id: id,
      nombre: 'Nuevo',
      categoria: CategoriaServicio.SH,
      precioUnitario: 200,
      moneda: 'MXN',
      tenantId,
    };
    servicioModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(updated),
    });

    const res = await service.update(id, {
      nombre: '  Nuevo  ',
      categoria: CategoriaServicio.SH,
      precioUnitario: 200,
      descripcion: '   ',
      moneda: 'USD',
    });

    expect(servicioModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, tenantId },
      {
        $set: {
          nombre: 'Nuevo',
          categoria: CategoriaServicio.SH,
          precioUnitario: 200,
          moneda: 'MXN',
        },
        $unset: { descripcion: 1 },
      },
      { new: true },
    );
    expect(res.nombre).toBe('Nuevo');
  });

  it('findOne cross-tenant → NotFound con filtro tenantId', async () => {
    const id = new Types.ObjectId().toString();
    servicioModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.findOne(id)).rejects.toBeInstanceOf(NotFoundException);

    expect(servicioModel.findOne).toHaveBeenCalledWith({
      _id: id,
      tenantId,
    });
    expect(tenantId).not.toEqual(otherTenantId);
  });

  it('onModuleInit backfill OTR en legacy sin categoria', async () => {
    servicioModel.updateMany.mockResolvedValue({ modifiedCount: 3 });
    await service.onModuleInit();
    expect(servicioModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.any(Array),
      }),
      { $set: { categoria: CategoriaServicio.OTR } },
    );
  });

  it('findAll default filtra activos ($ne: false) paginado con tenantId', async () => {
    const execFind = jest.fn().mockResolvedValue([{ nombre: 'A' }]);
    const limit = jest.fn().mockReturnValue({ exec: execFind });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    servicioModel.find.mockReturnValue({ sort });
    servicioModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });

    const res = await service.findAll();

    expect(servicioModel.find).toHaveBeenCalledWith({
      tenantId,
      activo: { $ne: false },
    });
    expect(res.data).toHaveLength(1);
    expect(res.total).toBe(1);
    expect(res.page).toBe(1);
    expect(res.limit).toBe(20);
    expect(res.totalPages).toBe(1);
  });

  it('findAll({ activo: false }) solo inactivos', async () => {
    const execFind = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec: execFind });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    servicioModel.find.mockReturnValue({ sort });
    servicioModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    await service.findAll({ activo: false });

    expect(servicioModel.find).toHaveBeenCalledWith({
      tenantId,
      activo: false,
    });
  });

  it('findAll escapa metacaracteres regex en nombre', async () => {
    const execFind = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec: execFind });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    servicioModel.find.mockReturnValue({ sort });
    servicioModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    await service.findAll({ nombre: 'Examen (MED)' });

    expect(servicioModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        nombre: { $regex: 'Examen \\(MED\\)', $options: 'i' },
      }),
    );
  });

  it('findAll filtra por categoria + nombre + activo', async () => {
    const execFind = jest.fn().mockResolvedValue([]);
    const limitFn = jest.fn().mockReturnValue({ exec: execFind });
    const skip = jest.fn().mockReturnValue({ limit: limitFn });
    const sort = jest.fn().mockReturnValue({ skip });
    servicioModel.find.mockReturnValue({ sort });
    servicioModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    await service.findAll({
      nombre: 'Rx',
      categoria: CategoriaServicio.MED,
      activo: false,
      page: 2,
      limit: 10,
    });

    expect(servicioModel.find).toHaveBeenCalledWith({
      tenantId,
      activo: false,
      nombre: { $regex: 'Rx', $options: 'i' },
      categoria: CategoriaServicio.MED,
    });
    expect(skip).toHaveBeenCalledWith(10);
    expect(limitFn).toHaveBeenCalledWith(10);
  });

  it('findAll totalPages con varios resultados', async () => {
    const execFind = jest.fn().mockResolvedValue([{ nombre: 'A' }]);
    const limit = jest.fn().mockReturnValue({ exec: execFind });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    servicioModel.find.mockReturnValue({ sort });
    servicioModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(25),
    });

    const res = await service.findAll({ page: 1, limit: 10 });
    expect(res.totalPages).toBe(3);
    expect(res.total).toBe(25);
  });

  it('remove soft-delete: activo=false sin findOneAndDelete', async () => {
    const id = new Types.ObjectId().toString();
    const deactivated = {
      _id: id,
      nombre: 'X',
      activo: false,
      tenantId,
    };
    servicioModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(deactivated),
    });

    const res = await service.remove(id);

    expect(servicioModel.findOneAndDelete).not.toHaveBeenCalled();
    expect(servicioModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, tenantId },
      { $set: { activo: false } },
      { new: true },
    );
    expect(res.activo).toBe(false);
  });

  it('toggleActivo reactiva servicio inactivo', async () => {
    const id = new Types.ObjectId().toString();
    const doc = {
      _id: id,
      activo: false,
      tenantId,
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };
    servicioModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });

    const res = await service.toggleActivo(id);

    expect(res.activo).toBe(true);
    expect(doc.save).toHaveBeenCalled();
  });

  it('toggleActivo con activo ausente (legacy) desactiva a false', async () => {
    const id = new Types.ObjectId().toString();
    const doc = {
      _id: id,
      tenantId,
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };
    servicioModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });

    const res = await service.toggleActivo(id);

    expect(res.activo).toBe(false);
    expect(doc.save).toHaveBeenCalled();
  });

  it('createForTenants crea un doc por tenant activo', async () => {
    (tenantsService.findById as jest.Mock)
      .mockResolvedValueOnce({ _id: tenantId, activo: true })
      .mockResolvedValueOnce({ _id: otherTenantId, activo: true });

    const res = await service.createForTenants({
      nombre: 'Examen',
      precioUnitario: 100,
      categoria: CategoriaServicio.MED,
      tenantIds: [tenantId.toString(), otherTenantId.toString()],
    });

    expect(res.created).toHaveLength(2);
    expect(savedDocs).toHaveLength(2);
    expect(savedDocs[0].tenantId).toEqual(tenantId);
    expect(savedDocs[1].tenantId).toEqual(otherTenantId);
    expect(tenantContext.getTenantId).not.toHaveBeenCalled();
  });

  it('createForTenants rechaza tenant inactivo', async () => {
    (tenantsService.findById as jest.Mock).mockResolvedValue({
      _id: tenantId,
      activo: false,
    });

    await expect(
      service.createForTenants({
        nombre: 'X',
        precioUnitario: 1,
        categoria: CategoriaServicio.OTR,
        tenantIds: [tenantId.toString()],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createForTenants rechaza tenant inexistente', async () => {
    (tenantsService.findById as jest.Mock).mockResolvedValue(null);

    await expect(
      service.createForTenants({
        nombre: 'X',
        precioUnitario: 1,
        categoria: CategoriaServicio.OTR,
        tenantIds: [new Types.ObjectId().toString()],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createForTenants rechaza tenantId malformado con BadRequest (no 404)', async () => {
    await expect(
      service.createForTenants({
        nombre: 'X',
        precioUnitario: 1,
        categoria: CategoriaServicio.OTR,
        tenantIds: ['not-a-valid-object-id'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tenantsService.findById).not.toHaveBeenCalled();
  });

  it('createForTenants compensa best-effort si falla el 2º save', async () => {
    (tenantsService.findById as jest.Mock)
      .mockResolvedValueOnce({ _id: tenantId, activo: true })
      .mockResolvedValueOnce({ _id: otherTenantId, activo: true });

    const originalImpl = servicioModel.getMockImplementation();
    let saveCount = 0;
    servicioModel.mockImplementation((data: any) => {
      const doc = {
        ...data,
        _id: new Types.ObjectId(),
        save: jest.fn().mockImplementation(async function (this: any) {
          saveCount += 1;
          if (saveCount === 2) {
            throw new Error('mongo write failed');
          }
          savedDocs.push(this);
          return this;
        }),
      };
      return doc;
    });

    try {
      await expect(
        service.createForTenants({
          nombre: 'Examen',
          precioUnitario: 100,
          categoria: CategoriaServicio.MED,
          tenantIds: [tenantId.toString(), otherTenantId.toString()],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(servicioModel.deleteOne).toHaveBeenCalledTimes(1);
      expect(servicioModel.deleteOne).toHaveBeenCalledWith({
        _id: savedDocs[0]._id,
      });
    } finally {
      if (originalImpl) {
        servicioModel.mockImplementation(originalImpl);
      }
    }
  });
});
