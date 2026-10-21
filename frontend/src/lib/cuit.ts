/**
 * CUIT: 11 dígitos con verificador módulo 11. Espejo de
 * backend/src/common/utils/cuit.ts, para avisar el error de tipeo en el campo
 * antes de mandar nada.
 */

const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const PREFIXES = new Set(['20', '23', '24', '25', '26', '27', '30', '33', '34']);

export const cuitDigits = (value: string): string => value.replace(/\D/g, '');

export const isValidCuit = (value: string): boolean => {
  const digits = cuitDigits(value);
  if (digits.length !== 11 || !PREFIXES.has(digits.slice(0, 2))) return false;
  const sum = WEIGHTS.reduce((acc, weight, index) => acc + weight * Number(digits[index]), 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) check = 9;
  return check === Number(digits[10]);
};

/** Mientras se escribe: 20-12345678-6. */
export const maskCuit = (value: string): string => {
  const digits = cuitDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
};
