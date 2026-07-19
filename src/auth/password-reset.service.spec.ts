import { PasswordResetService } from './password-reset.service';

describe('PasswordResetService.createResetTokenForAdmin', () => {
  const tokenModel = {
    deleteMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    create: jest.fn().mockResolvedValue({}),
  };
  const emailsService = {
    sendPasswordResetEmail: jest.fn(),
  };
  const usersService = {
    findByEmail: jest.fn(),
    update: jest.fn(),
  };

  const service = new PasswordResetService(
    tokenModel as any,
    emailsService as any,
    usersService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tokenModel.create.mockResolvedValue({});
    tokenModel.deleteMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({}),
    });
  });

  it('email inexistente: no envía correo', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.createResetTokenForAdmin('ghost@ames.test'),
    ).resolves.toBeUndefined();

    expect(emailsService.sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(tokenModel.create).not.toHaveBeenCalled();
  });

  it('usuario inactivo: no envía correo', async () => {
    usersService.findByEmail.mockResolvedValue({
      email: 'off@ames.test',
      nombre: 'Off',
      activo: false,
    });

    await expect(
      service.createResetTokenForAdmin('off@ames.test'),
    ).resolves.toBeUndefined();

    expect(emailsService.sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(tokenModel.create).not.toHaveBeenCalled();
  });

  it('usuario activo: crea token, envía y luego invalida previos', async () => {
    usersService.findByEmail.mockResolvedValue({
      email: 'ok@ames.test',
      nombre: 'Ok',
      activo: true,
    });
    emailsService.sendPasswordResetEmail.mockResolvedValue(undefined);

    await service.createResetTokenForAdmin('ok@ames.test');

    expect(tokenModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ok@ames.test',
        userType: 'admin',
      }),
    );
    expect(emailsService.sendPasswordResetEmail).toHaveBeenCalledWith(
      'ok@ames.test',
      'Ok',
      expect.any(String),
    );
    expect(tokenModel.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ok@ames.test',
        userType: 'admin',
        tokenHash: { $ne: expect.any(String) },
      }),
    );
  });

  it('fallo SMTP: no lanza y limpia token nuevo (no quema previos)', async () => {
    usersService.findByEmail.mockResolvedValue({
      email: 'ok@ames.test',
      nombre: 'Ok',
      activo: true,
    });
    emailsService.sendPasswordResetEmail.mockRejectedValue(
      new Error('SMTP down'),
    );

    await expect(
      service.createResetTokenForAdmin('ok@ames.test'),
    ).resolves.toBeUndefined();

    expect(tokenModel.create).toHaveBeenCalled();
    expect(tokenModel.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: expect.any(String) }),
    );
    // No debe invalidar “otros” tokens tras fallo de envío.
    expect(tokenModel.deleteMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: { $ne: expect.any(String) } }),
    );
  });

  it('fallo DB al crear token: no lanza (anti-enumeración)', async () => {
    usersService.findByEmail.mockResolvedValue({
      email: 'ok@ames.test',
      nombre: 'Ok',
      activo: true,
    });
    tokenModel.create.mockRejectedValueOnce(new Error('mongo down'));

    await expect(
      service.createResetTokenForAdmin('ok@ames.test'),
    ).resolves.toBeUndefined();

    expect(emailsService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('PasswordResetService.resetPasswordForAdmin', () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const tokenModel = {
    findOne: jest.fn(),
    deleteMany: jest.fn().mockReturnValue({ exec: jest.fn() }),
    create: jest.fn(),
  };
  const emailsService = { sendPasswordResetEmail: jest.fn() };
  const usersService = {
    findByEmail: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const service = new PasswordResetService(
    tokenModel as any,
    emailsService as any,
    usersService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('usuario inactivo: mismo error genérico de token', async () => {
    tokenModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ save }),
    });
    usersService.findByEmail.mockResolvedValue({
      _id: { toString: () => 'u1' },
      activo: false,
    });

    await expect(
      service.resetPasswordForAdmin('off@ames.test', 'a'.repeat(64), 'password1'),
    ).rejects.toThrow('Token inválido, expirado o ya utilizado');

    expect(usersService.update).not.toHaveBeenCalled();
  });

  it('usuario inexistente: mismo error genérico de token', async () => {
    tokenModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ save }),
    });
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.resetPasswordForAdmin('gone@ames.test', 'a'.repeat(64), 'password1'),
    ).rejects.toThrow('Token inválido, expirado o ya utilizado');

    expect(usersService.update).not.toHaveBeenCalled();
  });
});
