/**
 * Logica de negocio y utilidades cliente para DT-e API-SEM (SENASA).
 *
 * Todas las fechas del DT-e se operan como dias calendario (YYYY-MM-DD)
 * en el huso horario oficial de Argentina (UTC-3).
 */

export const MIN_VALIDITY_DAYS = 2;
export const MAX_VALIDITY_DAYS = 4;
export const DEFAULT_VALIDITY_DAYS = 3;
export const LAPSE_GRACE_DAYS = 5;

export type TransitSemaphore = 'VERDE' | 'AMARILLO' | 'ROJO' | 'AZUL' | 'GRIS';

/**
 * Devuelve la fecha actual en formato YYYY-MM-DD en hora oficial argentina (UTC-3).
 */
export function todayAr(now: Date = new Date()): string {
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const arDate = new Date(utc - 3 * 3600000);
  const y = arDate.getFullYear();
  const m = String(arDate.getMonth() + 1).padStart(2, '0');
  const d = String(arDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toArgentinaDateString(date: Date = new Date()): string {
  return todayAr(date);
}

/**
 * Formatea una fecha ISO o YYYY-MM-DD a formato amigable argentino (DD/MM/YYYY).
 */
export function formatDay(iso?: string | null): string {
  if (!iso) return '-';
  const clean = iso.includes('T') ? iso.split('T')[0] : iso;
  const parts = clean.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Suma o resta dias a una fecha en formato YYYY-MM-DD.
 */
export function addDaysIso(dateStr: string, days: number): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(dt.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

/**
 * Cantidad de dias entre dos fechas YYYY-MM-DD (to - from).
 */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  if (!fromIso || !toIso) return 0;
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86400000);
}

/**
 * Normaliza patentes argentinas eliminando espacios, guiones y pasando a mayusculas.
 */
export function normalizePlate(raw?: string | null): string {
  if (!raw) return '';
  return raw.trim().toUpperCase().replace(/[\s\-_.]/g, '');
}

/**
 * Valida si una patente cumple con el patron oficial argentino
 * (clasico AAA123, Mercosur AA123BB, o trailers 101).
 */
export function isValidPlate(raw?: string | null): boolean {
  const plate = normalizePlate(raw);
  if (!plate) return false;
  const classic = /^[A-Z]{3}\d{3}$/;
  const mercosur = /^[A-Z]{2}\d{3}[A-Z]{2}$/;
  const trailer = /^(101)?[A-Z]{2,3}\d{3}[A-Z]{0,2}$/;
  return classic.test(plate) || mercosur.test(plate) || trailer.test(plate);
}

/**
 * Sugerencia de alzas declaradas con sobreestimacion prudencial (+15%).
 * En la normativa SENASA, lo recepcionado en sala no puede superar lo declarado:
 * Q_real <= Q_declarada.
 */
export function suggestDeclaredQuantity(estimated: number): number {
  if (!estimated || estimated <= 0) return 0;
  return Math.ceil(estimated * 1.15);
}

/**
 * Semaforo de transito en tiempo real para transportistas y salas.
 */
export function getTransitSemaphore(dte: {
  status: string;
  loadDate?: string | Date | null;
  expiryDate?: string | Date | null;
  now?: Date;
}): { semaphore: TransitSemaphore; reason: string; canTransit: boolean } {
  const status = dte.status;

  if (status === 'CERRADO' || status === 'CLOSED') {
    return {
      semaphore: 'AZUL',
      reason: 'DT-e cerrado en sala tras recepcion conforme.',
      canTransit: false,
    };
  }

  if (['ANULADO', 'ELIMINADO', 'RECHAZADO', 'CANCELLED'].includes(status)) {
    return {
      semaphore: 'ROJO',
      reason: `Documento ${status}. Transito prohibido por ruta.`,
      canTransit: false,
    };
  }

  if (status === 'SIN_ARRIBO') {
    return {
      semaphore: 'GRIS',
      reason: 'Declarado sin arribo a destino.',
      canTransit: false,
    };
  }

  if (status === 'BORRADOR' || status === 'DRAFT' || status === 'SOLICITADO') {
    return {
      semaphore: 'ROJO',
      reason: 'El DT-e todavia no cuenta con autorizacion oficial de SENASA.',
      canTransit: false,
    };
  }

  const todayStr = todayAr(dte.now);
  const loadStr = dte.loadDate
    ? typeof dte.loadDate === 'string'
      ? dte.loadDate.split('T')[0]
      : todayAr(dte.loadDate)
    : '';
  const expiryStr = dte.expiryDate
    ? typeof dte.expiryDate === 'string'
      ? dte.expiryDate.split('T')[0]
      : todayAr(dte.expiryDate)
    : '';

  if (status === 'CADUCADO' || (expiryStr && todayStr > addDaysIso(expiryStr, LAPSE_GRACE_DAYS))) {
    return {
      semaphore: 'ROJO',
      reason: 'DT-e caducado definitivamente (mas de 5 dias post-vencimiento).',
      canTransit: false,
    };
  }

  if (status === 'VENCIDO' || (expiryStr && todayStr > expiryStr)) {
    return {
      semaphore: 'ROJO',
      reason: 'Plazo maximo de vigencia vencido. Transito no autorizado.',
      canTransit: false,
    };
  }

  if ((status === 'EMITIDO' || status === 'ISSUED') && loadStr && todayStr < loadStr) {
    return {
      semaphore: 'ROJO',
      reason: `DT-e emitido pero previo a la fecha autorizada de carga (${formatDay(loadStr)}).`,
      canTransit: false,
    };
  }

  if (status === 'VIGENTE' || status === 'EMITIDO' || status === 'ISSUED') {
    if (expiryStr && todayStr === expiryStr) {
      return {
        semaphore: 'AMARILLO',
        reason: 'DT-e vence en el transcurso del dia de hoy.',
        canTransit: true,
      };
    }
    return {
      semaphore: 'VERDE',
      reason: 'DT-e vigente y habilitado para circular por ruta nacional.',
      canTransit: true,
    };
  }

  return {
    semaphore: 'ROJO',
    reason: `Estado ${status} no autoriza circulacion.`,
    canTransit: false,
  };
}

export function getTransitSemaphoreTone(semaphore: TransitSemaphore): 'emerald' | 'amber' | 'rose' | 'indigo' | 'neutral' {
  switch (semaphore) {
    case 'VERDE':
      return 'emerald';
    case 'AMARILLO':
      return 'amber';
    case 'ROJO':
      return 'rose';
    case 'AZUL':
      return 'indigo';
    case 'GRIS':
    default:
      return 'neutral';
  }
}
