/**
 * CUIT / CUIL argentina: 11 digitos, prefijo de tipo de persona y digito
 * verificador modulo 11 (algoritmo de ARCA, ex AFIP).
 *
 * Se guarda sin guiones. Se valida el digito verificador porque la CUIT es el
 * dato con el que SIGSA emite el DT-e a nombre del titular: un error de tipeo
 * no debe llegar hasta ahi.
 */

const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/** Personas humanas (20, 23, 24, 25, 26, 27) y juridicas (30, 33, 34). */
const PREFIXES = new Set(['20', '23', '24', '25', '26', '27', '30', '33', '34']);

/** Solo los digitos; null si no queda ninguno. */
export const normalizeCuit = (value: string | null | undefined): string | null => {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
};

/** Digito verificador que corresponde a los primeros 10 digitos. */
export const cuitCheckDigit = (firstTen: string): number => {
  const sum = WEIGHTS.reduce((acc, weight, index) => acc + weight * Number(firstTen[index]), 0);
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return 0;
  if (remainder === 10) return 9;
  return remainder;
};

export const isValidCuit = (value: string | null | undefined): boolean => {
  const digits = normalizeCuit(value);
  if (!digits || !/^\d{11}$/.test(digits)) return false;
  if (!PREFIXES.has(digits.slice(0, 2))) return false;
  return cuitCheckDigit(digits.slice(0, 10)) === Number(digits[10]);
};

/** 20-12345678-6, para mostrar. */
export const formatCuit = (value: string | null | undefined): string | null => {
  const digits = normalizeCuit(value);
  if (!digits || digits.length !== 11) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
};

/** Las CUIT de personas juridicas empiezan con 30, 33 o 34. */
export const isLegalEntityCuit = (value: string | null | undefined): boolean => {
  const digits = normalizeCuit(value);
  return Boolean(digits && ['30', '33', '34'].includes(digits.slice(0, 2)));
};
