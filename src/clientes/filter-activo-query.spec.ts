import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FilterClienteDto } from './dto/filter-cliente.dto';
import { FilterContactoDto } from './dto/filter-contacto.dto';

const queryPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  });

describe('FilterClienteDto / FilterContactoDto query activo (Story 3.6)', () => {
  describe('plainToInstance Transform', () => {
    it('FilterClienteDto: query string "false" → boolean false', () => {
      const dto = plainToInstance(FilterClienteDto, { activo: 'false' });
      expect(dto.activo).toBe(false);
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('FilterClienteDto: query string "true" → boolean true', () => {
      const dto = plainToInstance(FilterClienteDto, { activo: 'true' });
      expect(dto.activo).toBe(true);
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('FilterClienteDto: omitido → undefined', () => {
      const dto = plainToInstance(FilterClienteDto, { page: '1' });
      expect(dto.activo).toBeUndefined();
    });

    it('FilterContactoDto: query string "false" → boolean false', () => {
      const dto = plainToInstance(FilterContactoDto, { activo: 'false' });
      expect(dto.activo).toBe(false);
      expect(validateSync(dto)).toHaveLength(0);
    });
  });

  describe('ValidationPipe (mismo config que main.ts)', () => {
    it('FilterClienteDto: activo=false query no se convierte a true', async () => {
      const pipe = queryPipe();
      const dto = (await pipe.transform(
        { activo: 'false', page: '1', limit: '20' },
        { type: 'query', metatype: FilterClienteDto, data: '' },
      )) as FilterClienteDto;
      expect(dto.activo).toBe(false);
    });

    it('FilterContactoDto: activo=false query no se convierte a true', async () => {
      const pipe = queryPipe();
      const dto = (await pipe.transform(
        { activo: 'false', page: '1', limit: '20' },
        { type: 'query', metatype: FilterContactoDto, data: '' },
      )) as FilterContactoDto;
      expect(dto.activo).toBe(false);
    });

    it('FilterClienteDto: activo omitido queda undefined', async () => {
      const pipe = queryPipe();
      const dto = (await pipe.transform(
        { page: '1', limit: '20' },
        { type: 'query', metatype: FilterClienteDto, data: '' },
      )) as FilterClienteDto;
      expect(dto.activo).toBeUndefined();
    });

    it('FilterClienteDto: activo inválido → 400', async () => {
      const pipe = queryPipe();
      await expect(
        pipe.transform(
          { activo: 'nope' },
          { type: 'query', metatype: FilterClienteDto, data: '' },
        ),
      ).rejects.toBeTruthy();
    });

    it('FilterClienteDto: solo espacios ≡ omitido (undefined)', async () => {
      const pipe = queryPipe();
      const dto = (await pipe.transform(
        { activo: '   ', page: '1' },
        { type: 'query', metatype: FilterClienteDto, data: '' },
      )) as FilterClienteDto;
      expect(dto.activo).toBeUndefined();
    });

    it('FilterClienteDto: objeto anidado (activo[foo]) → 400, no true', async () => {
      const pipe = queryPipe();
      await expect(
        pipe.transform(
          { activo: { foo: 'false' } },
          { type: 'query', metatype: FilterClienteDto, data: '' },
        ),
      ).rejects.toBeTruthy();
    });

    it('FilterClienteDto: array (param repetido) → 400', async () => {
      const pipe = queryPipe();
      await expect(
        pipe.transform(
          { activo: ['false', 'true'] },
          { type: 'query', metatype: FilterClienteDto, data: '' },
        ),
      ).rejects.toBeTruthy();
    });
  });
});
