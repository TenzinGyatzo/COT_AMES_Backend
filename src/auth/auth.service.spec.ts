import { AuthService } from './auth.service';
import { Roles } from './enums/roles.enum';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService.login', () => {
  const jwtService = { sign: jest.fn(() => 'token') };
  const usersService = {};
  const service = new AuthService(usersService as any, jwtService as any);

  it('emite JWT con rol operativo y tipoUsuario alineado', async () => {
    const result = await service.login({
      _id: 'u1',
      email: 'op@ames.test',
      nombre: 'Op',
      rol: Roles.OPERATIVO,
      tenantId: 't1',
      activo: true,
    });

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'u1',
        rol: Roles.OPERATIVO,
        tipoUsuario: Roles.OPERATIVO,
        tenantId: 't1',
      }),
    );
    expect(result.user.rol).toBe(Roles.OPERATIVO);
    expect(result.user.tipoUsuario).toBe(Roles.OPERATIVO);
    expect(result.access_token).toBe('token');
  });

  it('admin_sistema sin tenantId en payload', async () => {
    await service.login({
      _id: 'u2',
      email: 'admin@ames.test',
      nombre: 'Admin',
      rol: Roles.ADMIN_SISTEMA,
      activo: true,
    });

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.not.objectContaining({ tenantId: expect.anything() }),
    );
  });
});

describe('AuthService.validateUser', () => {
  const jwtService = { sign: jest.fn() };
  const usersService = {
    findByEmailWithPassword: jest.fn(),
  };
  const service = new AuthService(usersService as any, jwtService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rechaza usuario con activo: false', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({
      email: 'inactivo@ames.test',
      passwordHash: 'hash',
      activo: false,
      toObject: () => ({ email: 'inactivo@ames.test', activo: false }),
    });

    const result = await service.validateUser(
      'inactivo@ames.test',
      'cualquier-password',
    );

    expect(result).toBeNull();
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('acepta usuario activo con password válida', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({
      email: 'activo@ames.test',
      passwordHash: 'hash',
      activo: true,
      rol: Roles.OPERATIVO,
      toObject: () => ({
        email: 'activo@ames.test',
        activo: true,
        rol: Roles.OPERATIVO,
      }),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.validateUser('activo@ames.test', 'ok');

    expect(result).toEqual(
      expect.objectContaining({ email: 'activo@ames.test', activo: true }),
    );
  });
});
