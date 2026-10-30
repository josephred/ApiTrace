/**
 * Finca de polinización (doc 14): el campo de un tercero al que el apicultor
 * lleva colmenas a polinizar. Se registra desde «Carga de datos» con nombre,
 * zona, RENSPA del campo (opcional), ubicación, colmenas y foto.
 */

export const FINCA_TYPE = 'FINCA_POLINIZACION';

/** Mismo control que el backend: números con puntos, barra o guiones. */
const FIELD_RENSPA = /^[0-9][0-9 ./-]{6,58}[0-9]$/;

/** «  01.002.0.00123/45 » → «01.002.0.00123/45». */
export const cleanRenspa = (value: string): string => value.trim().replace(/\s+/g, ' ');

/**
 * El RENSPA es opcional: vacío está bien. Si se escribe, se controla la forma
 * para atajar un error de tipeo, no el padrón de SENASA.
 */
export const renspaError = (value: string): string | null => {
  const clean = cleanRenspa(value);
  if (!clean) return null;
  if (clean.length > 60 || !FIELD_RENSPA.test(clean)) {
    return 'Revisá el RENSPA: son números con puntos y barra (ej. 01.002.0.00123/45).';
  }
  return null;
};
