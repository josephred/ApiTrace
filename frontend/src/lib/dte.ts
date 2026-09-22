import type { Dte, DteStatus } from './types';

/**
 * Ayudas de presentacion del DT-e. Las reglas viven en el backend
 * (dte.rules.ts); aca solo se replica lo necesario para responder al instante
 * mientras se completa un formulario, sin esperar a la red.
 */

/** Factor de sobreestimacion sugerido (el mismo que DTE_RULES en el backend). */
export const OVERESTIMATION_FACTOR = 1.5;
export const MAX_VALIDITY_DAYS = 4;
export const DEFAULT_VALIDITY_DAYS = 2;
export const MAX_ANTICIPATION_DAYS = 4;

/** Alzas sugeridas para declarar a partir de las estimadas. */
export const suggestDeclared = (estimated: number): number =>
  Math.max(estimated + 1, Math.ceil(estimated * OVERESTIMATION_FACTOR));

/** Dia calendario de hoy en Argentina (UTC-3), como YYYY-MM-DD. */
export const todayAr = (now: Date = new Date()): string =>
  new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const addDaysIso = (date: string, days: number): string => {
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
};

export const daysBetweenIso = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * Fecha de calendario (YYYY-MM-DD) en formato argentino. No pasa por Date:
 * `new Date('2026-09-21')` es medianoche UTC y en Argentina se leeria 20/09.
 */
export const formatDay = (value: string | null | undefined): string => {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

export interface TransitLight {
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  title: string;
  detail: string;
}

/** Semaforo de transito (checklist 9 de la especificacion). */
export const transitLight = (
  dte: Pick<Dte, 'status' | 'loadDate' | 'expiryDate'>,
): TransitLight => {
  switch (dte.status) {
    case 'VIGENTE':
      return {
        tone: 'success',
        title: 'Apto para transitar',
        detail: `Hasta el ${formatDay(dte.expiryDate)} a las 23:59. Llevá el DT-e impreso en la cabina.`,
      };
    case 'EMITIDO':
      return {
        tone: 'warning',
        title: 'Todavía no transita',
        detail: `Se habilita el ${formatDay(dte.loadDate)} a las 00:00.`,
      };
    case 'BORRADOR':
    case 'SOLICITADO':
      return {
        tone: 'neutral',
        title: 'Sin emitir',
        detail: 'Hasta que SIGSA asigne número, el traslado no está amparado.',
      };
    case 'CERRADO':
      return { tone: 'success', title: 'Cerrado', detail: 'La sala confirmó el arribo.' };
    case 'VENCIDO':
      return {
        tone: 'danger',
        title: 'No transita: vencido',
        detail: 'La sala todavía puede cerrarlo durante el período de gracia.',
      };
    default:
      return {
        tone: 'danger',
        title: 'No transita',
        detail: 'Este DT-e no ampara ningún traslado.',
      };
  }
};

/** Estados en los que el DT-e ya no cambia. */
export const FINAL_STATUSES: DteStatus[] = [
  'CERRADO',
  'CADUCADO',
  'SIN_ARRIBO',
  'RECHAZADO',
  'ANULADO',
  'ELIMINADO',
];

/** Filtros del listado, en el orden en que se recorre el ciclo de vida. */
export const DTE_STATUS_FILTERS: DteStatus[] = [
  'BORRADOR',
  'SOLICITADO',
  'EMITIDO',
  'VIGENTE',
  'VENCIDO',
  'CERRADO',
  'CADUCADO',
  'SIN_ARRIBO',
  'ANULADO',
  'ELIMINADO',
  'RECHAZADO',
];

/** Patente sin espacios ni guiones, en mayusculas. */
export const normalizePlate = (value: string): string => value.toUpperCase().replace(/[\s.-]/g, '');
