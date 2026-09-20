/**
 * Reglas de negocio puras del Documento de Transito electronico (DT-e API-SEM).
 * Normativa: Resolucion SENASA 356/2008 y 875/2020.
 *
 * Estas funciones son deterministas, no tocan base de datos y pueden
 * compartirse conceptualmente entre backend y frontend.
 */

export const MIN_VALIDITY_DAYS = 2;
export const MAX_VALIDITY_DAYS = 4;
export const DEFAULT_VALIDITY_DAYS = 2;
export const LAPSE_GRACE_DAYS = 4;

/** Estados oficiales del DT-e (11 estados segun API-SEM SENASA). */
export const DteStatuses = {
  BORRADOR: 'BORRADOR',
  SOLICITADO: 'SOLICITADO',
  EMITIDO: 'EMITIDO',
  VIGENTE: 'VIGENTE',
  VENCIDO: 'VENCIDO',
  CADUCADO: 'CADUCADO',
  CERRADO: 'CERRADO',
  SIN_ARRIBO: 'SIN_ARRIBO',
  ANULADO: 'ANULADO',
  ELIMINADO: 'ELIMINADO',
  RECHAZADO: 'RECHAZADO',
} as const;

export type DteStatus = (typeof DteStatuses)[keyof typeof DteStatuses];

/** Modos de emision soportados. */
export const IssueModes = {
  MANUAL: 'MANUAL',
  SIMULADO: 'SIMULADO',
  SIGSA: 'SIGSA',
} as const;

export type IssueMode = (typeof IssueModes)[keyof typeof IssueModes];

/** Semáforo de transito para el transporte. */
export type TransitSemaphore = 'VERDE' | 'AMARILLO' | 'ROJO' | 'AZUL' | 'GRIS';

/**
 * Convierte una fecha a formato YYYY-MM-DD en zona horaria Argentina (UTC-3).
 */
export function toArgentinaDateString(date: Date = new Date()): string {
  // Desplazamiento UTC-3 (180 minutos)
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const arDate = new Date(utc - 3 * 3600000);
  const y = arDate.getFullYear();
  const m = String(arDate.getMonth() + 1).padStart(2, '0');
  const d = String(arDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Obtiene el inicio del dia en UTC-3 como objeto Date.
 */
export function startOfDayAr(dateStr: string): Date {
  // dateStr: YYYY-MM-DD
  return new Date(`${dateStr}T00:00:00.000-03:00`);
}

/**
 * Obtiene el fin del dia en UTC-3 como objeto Date.
 */
export function endOfDayAr(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999-03:00`);
}

/**
 * Suma dias a una fecha en formato YYYY-MM-DD.
 */
export function addDaysIso(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(dt.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

/**
 * Calcula la diferencia en dias entre dos fechas YYYY-MM-DD.
 */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86400000);
}

/**
 * Normaliza y valida una patente automotor argentina.
 * Formatos aceptados:
 * - Clasico: 3 letras + 3 numeros (AAA123)
 * - Mercosur: 2 letras + 3 numeros + 2 letras (AA123BB)
 * - Moto: 3 numeros + 3 letras o 1 letra + 3 numeros + 3 letras
 */
export function normalizePlate(raw?: string | null): string {
  if (!raw) return '';
  return raw.trim().toUpperCase().replace(/[\s\-_.]/g, '');
}

export function isValidPlate(raw?: string | null): boolean {
  const plate = normalizePlate(raw);
  if (!plate) return false;
  // Clasico: 3 letras y 3 numeros
  const classic = /^[A-Z]{3}\d{3}$/;
  // Mercosur automotor: 2 letras, 3 numeros, 2 letras
  const mercosur = /^[A-Z]{2}\d{3}[A-Z]{2}$/;
  // Acoplado o trailer tipo 101 o trailer clasico
  const trailer = /^(101)?[A-Z]{2,3}\d{3}[A-Z]{0,2}$/;
  return classic.test(plate) || mercosur.test(plate) || trailer.test(plate);
}

/**
 * Sugiere la cantidad declarada con sobreestimacion prudencial (+15%).
 * En material melario (alzas), la normativa de SENASA exige que la cantidad
 * recibida en sala de extraccion NO supere la cantidad declarada en el DT-e:
 * Q_real <= Q_declarada.
 */
export function suggestDeclaredQuantity(estimatedQuantity: number): number {
  if (!estimatedQuantity || estimatedQuantity <= 0) return 0;
  // Margen del 15%, redondeado hacia arriba
  return Math.ceil(estimatedQuantity * 1.15);
}

/**
 * Determina el semaforo de transito segun el estado y fechas del DT-e.
 */
export function getTransitSemaphore(dte: {
  status: string;
  loadDate?: Date | string | null;
  expiryDate?: Date | string | null;
  now?: Date;
}): { semaphore: TransitSemaphore; reason: string; canTransit: boolean } {
  const now = dte.now ?? new Date();
  const status = dte.status as DteStatus;

  if (status === DteStatuses.CERRADO) {
    return {
      semaphore: 'AZUL',
      reason: 'DT-e cerrado en sala de destino tras recepcion conforme.',
      canTransit: false,
    };
  }

  if (status === DteStatuses.ANULADO || status === DteStatuses.ELIMINADO || status === DteStatuses.RECHAZADO) {
    return {
      semaphore: 'ROJO',
      reason: `DT-e en estado terminal ${status}. Transito prohibido.`,
      canTransit: false,
    };
  }

  if (status === DteStatuses.SIN_ARRIBO) {
    return {
      semaphore: 'GRIS',
      reason: 'Declarado sin arribo a destino.',
      canTransit: false,
    };
  }

  if (status === DteStatuses.BORRADOR || status === DteStatuses.SOLICITADO) {
    return {
      semaphore: 'ROJO',
      reason: 'El DT-e aun no ha sido emitido ante SENASA.',
      canTransit: false,
    };
  }

  const loadTime = dte.loadDate
    ? typeof dte.loadDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dte.loadDate)
      ? startOfDayAr(dte.loadDate.slice(0, 10)).getTime()
      : new Date(dte.loadDate).getTime()
    : 0;
  const expiryTime = dte.expiryDate
    ? typeof dte.expiryDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dte.expiryDate)
      ? endOfDayAr(dte.expiryDate.slice(0, 10)).getTime()
      : new Date(dte.expiryDate).getTime()
    : 0;
  const nowTime = now.getTime();

  if (status === DteStatuses.CADUCADO || (expiryTime > 0 && nowTime > expiryTime + LAPSE_GRACE_DAYS * 86400000)) {
    return {
      semaphore: 'ROJO',
      reason: 'DT-e caducado (mas de 5 dias posteriores a su vencimiento). Requiere regularizacion.',
      canTransit: false,
    };
  }

  if (status === DteStatuses.VENCIDO || (expiryTime > 0 && nowTime > expiryTime)) {
    return {
      semaphore: 'ROJO',
      reason: 'DT-e con vigencia vencida. Transito no autorizado sin regularizar.',
      canTransit: false,
    };
  }

  if (status === DteStatuses.EMITIDO && loadTime > 0 && nowTime < loadTime) {
    return {
      semaphore: 'ROJO',
      reason: 'DT-e emitido pero previo a la fecha autorizada de carga.',
      canTransit: false,
    };
  }

  if (status === DteStatuses.VIGENTE || status === DteStatuses.EMITIDO) {
    // Si esta dentro de las 12 horas del vencimiento, se marca en amarillo
    const hoursLeft = (expiryTime - nowTime) / 3600000;
    if (hoursLeft <= 18) {
      return {
        semaphore: 'AMARILLO',
        reason: `DT-e proximo a vencer (quedan aprox. ${Math.max(1, Math.round(hoursLeft))} horas).`,
        canTransit: true,
      };
    }
    return {
      semaphore: 'VERDE',
      reason: 'DT-e vigente y habilitado para transito por ruta nacional.',
      canTransit: true,
    };
  }

  return {
    semaphore: 'ROJO',
    reason: `Estado ${status} no habilita transito.`,
    canTransit: false,
  };
}

/**
 * Valida las transiciones de estado permitidas del ciclo de vida oficial.
 */
export function isAllowedTransition(from: DteStatus, to: DteStatus): boolean {
  if (from === to) return true;

  const allowed: Record<DteStatus, DteStatus[]> = {
    [DteStatuses.BORRADOR]: [DteStatuses.SOLICITADO, DteStatuses.ELIMINADO],
    [DteStatuses.SOLICITADO]: [DteStatuses.EMITIDO, DteStatuses.RECHAZADO, DteStatuses.BORRADOR],
    [DteStatuses.EMITIDO]: [DteStatuses.VIGENTE, DteStatuses.ANULADO, DteStatuses.VENCIDO],
    [DteStatuses.VIGENTE]: [
      DteStatuses.VENCIDO,
      DteStatuses.CERRADO,
      DteStatuses.SIN_ARRIBO,
      DteStatuses.ANULADO,
    ],
    [DteStatuses.VENCIDO]: [
      DteStatuses.CADUCADO,
      DteStatuses.CERRADO,
      DteStatuses.SIN_ARRIBO,
    ],
    [DteStatuses.CADUCADO]: [DteStatuses.CERRADO],
    [DteStatuses.CERRADO]: [],
    [DteStatuses.SIN_ARRIBO]: [],
    [DteStatuses.ANULADO]: [],
    [DteStatuses.ELIMINADO]: [],
    [DteStatuses.RECHAZADO]: [DteStatuses.BORRADOR],
  };

  return allowed[from]?.includes(to) ?? false;
}
