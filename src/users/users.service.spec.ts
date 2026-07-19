import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { Roles } from '../auth/enums/roles.enum';

describe('UsersService (Story 1.6)', () => {
  const tenantId = new Types.ObjectId();
  const userModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
    updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }) }),
  };

  const tenantsService = {
    findById: jest.fn(),
  };

  // Constructor will call onModuleInit via Nest in prod; unit: new without init side effects after mock
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(userModel as any, tenantsService as any);
    userModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
  });

  it('create operativo sin tenantId → BadRequest', async () => {
    await expect(
      service.create({
        email: 'op@ames.mx',
        password: 'secret1',
        nombre: 'Op',
        rol: Roles.OPERATIVO,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create operativo con tenant activo → OK', async () => {
    tenantsService.findById.mockResolvedValue({ _id: tenantId, activo: true });
    const save = jest.fn().mockResolvedValue({
      toObject: () => ({
        _id: new Types.ObjectId(),
        email: 'op@ames.mx',
        nombre: 'Op',
        rol: Roles.OPERATIVO,
        tenantId,
        activo: true,
      }),
    });
    // Intercept `new this.userModel`
    const ModelCtor = function (this: any, data: any) {
      Object.assign(this, data);
      this.save = save;
      this.toObject = () => ({ ...data, passwordHash: 'x' });
    } as any;
    (service as any).userModel = Object.assign(ModelCtor, userModel);

    const doc = await service.create({
      email: 'OP@AMES.MX',
      password: 'secret1',
      nombre: 'Op',
      rol: Roles.OPERATIVO,
      tenantId: tenantId.toString(),
    });

    expect(save).toHaveBeenCalled();
    expect(doc).toBeDefined();
  });

  it('create admin con tenantId → BadRequest', async () => {
    await expect(
      service.create({
        email: 'admin@ames.mx',
        password: 'secret1',
        nombre: 'Admin',
        rol: Roles.ADMIN_SISTEMA,
        tenantId: tenantId.toString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create email duplicado → Conflict', async () => {
    userModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ email: 'a@a.com' }),
    });
    await expect(
      service.create({
        email: 'a@a.com',
        password: 'secret1',
        nombre: 'A',
        rol: Roles.ADMIN_SISTEMA,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('findAll default filtra activo:true', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const select = jest.fn().mockReturnValue({ exec });
    const sort = jest.fn().mockReturnValue({ select });
    userModel.find.mockReturnValue({ sort });

    await service.findAll();

    expect(userModel.find).toHaveBeenCalledWith({ activo: true });
  });

  it('findById id inválido → NotFound', async () => {
    await expect(service.findById('bad-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('create sin rol → BadRequest', async () => {
    await expect(
      service.create({
        email: 'x@ames.mx',
        password: 'secret1',
        nombre: 'X',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create nombre solo espacios → BadRequest', async () => {
    await expect(
      service.create({
        email: 'x@ames.mx',
        password: 'secret1',
        nombre: '   ',
        rol: Roles.ADMIN_SISTEMA,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('softDelete del último admin activo → BadRequest', async () => {
    const oid = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    userModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: oid,
        rol: Roles.ADMIN_SISTEMA,
        activo: true,
        save: jest.fn(),
      }),
    });
    userModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });

    await expect(service.softDelete(oid)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
