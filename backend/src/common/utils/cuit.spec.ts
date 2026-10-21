import { cuitCheckDigit, formatCuit, isLegalEntityCuit, isValidCuit, normalizeCuit } from './cuit';

describe('CUIT', () => {
  it('calcula el digito verificador modulo 11', () => {
    // 20-12345678-? : 5*2+4*0+3*1+2*2+7*3+6*4+5*5+4*6+3*7+2*8 = 148 -> 11 - (148 % 11) = 6
    expect(cuitCheckDigit('2012345678')).toBe(6);
    expect(isValidCuit('20-12345678-6')).toBe(true);
  });

  it('acepta guiones, espacios y puntos', () => {
    expect(isValidCuit('20 12345678 6')).toBe(true);
    expect(isValidCuit('20.12345678.6')).toBe(true);
    expect(normalizeCuit('20-12345678-6')).toBe('20123456786');
  });

  it('rechaza digito verificador equivocado, largo distinto y prefijo inexistente', () => {
    expect(isValidCuit('20-12345678-5')).toBe(false);
    expect(isValidCuit('2012345678')).toBe(false);
    expect(isValidCuit('201234567866')).toBe(false);
    const firstTen = '1112345678';
    expect(isValidCuit(`${firstTen}${cuitCheckDigit(firstTen)}`)).toBe(false);
    expect(isValidCuit('')).toBe(false);
    expect(isValidCuit(null)).toBe(false);
  });

  it('formatea y distingue personas juridicas', () => {
    expect(formatCuit('20123456786')).toBe('20-12345678-6');
    const legal = `3071234567${cuitCheckDigit('3071234567')}`;
    expect(isValidCuit(legal)).toBe(true);
    expect(isLegalEntityCuit(legal)).toBe(true);
    expect(isLegalEntityCuit('20123456786')).toBe(false);
  });
});
