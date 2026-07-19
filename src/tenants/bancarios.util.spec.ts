import { hasBancariosUtiles } from './bancarios.util';

describe('hasBancariosUtiles', () => {
  it('true con CLABE', () => {
    expect(hasBancariosUtiles({ clabe: '012345678901234567' })).toBe(true);
  });

  it('true con banco+cuenta', () => {
    expect(hasBancariosUtiles({ banco: 'BBVA', cuenta: '123' })).toBe(true);
  });

  it('false si solo banco', () => {
    expect(hasBancariosUtiles({ banco: 'BBVA' })).toBe(false);
  });

  it('false si vacío / null', () => {
    expect(hasBancariosUtiles({})).toBe(false);
    expect(hasBancariosUtiles(null)).toBe(false);
    expect(hasBancariosUtiles(undefined)).toBe(false);
  });
});
