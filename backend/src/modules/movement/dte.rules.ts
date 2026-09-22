/**
 * Reglas del DT-e API-SEM (especificacion tecnica DT-e, secciones 4 y 5).
 *
 * Todo lo que depende del reloj y de la norma vive aca, en funciones puras y
 * sin acceso a la base: el servicio, el barrido periodico, el despacho del
 * movimiento y la trazabilidad consultan las mismas reglas, y se prueban sin
 * levantar PostgreSQL (dte.rules.spec.ts).
 */

export const DTE_STATUSES = [
  'BORRADOR',
  'SOLICITADO',
  'EMITIDO',
  'VIGENTE',
  'CERRADO',
  'VENCIDO',
  'CADUCADO',
  'SIN_ARRIBO',
  'RECHAZADO',
  'ANULADO',
  'ELIMINADO',
] as const;

export type DteStatus = (typeof DTE_STATUSES)[number];

export type DteIssueMode = 'MANUAL' | 'SIMULADO' | 'SIGSA';

/**
 * Parametros normativos. Son constantes y no configuracion porque salen de la
 * norma: si SENASA los cambia, el cambio se revisa y se prueba, no se edita en
 * una variable de entorno.
 */
export const DTE_RULES = {
  /** Tipo de movimiento SIGSA: apiarios a sala de extraccion. */
  movementTypeCode: 'API-SEM',
  transitReason: 'Extracción de miel',
  /** Alzas melarias. Enteras, medias y 3/4 se computan igual: unidades. */
  productCode: '24.45',
  productName: 'Alzas melarias',
  unit: 'UNIDAD',
  /** Vencimiento por defecto: carga + 2 dias. */
  defaultValidityDays: 2,
  minValidityDays: 2,
  /** Ampliable hasta 4 dias posteriores a la fecha de carga. */
  maxValidityDays: 4,
  /** Autogestion: hasta 4 dias de anticipacion a la fecha de carga. */
  maxAnticipationDays: 4,
  /** Periodo de gracia tras el vencimiento; despues, CADUCADO. */
  graceDays: 4,
  /** Factor sugerido para sobreestimar las alzas declaradas (regla 4.2.1). */
  overestimationFactor: 1.5,
  /** Hora oficial argentina (UTC-3, sin horario de verano desde 2009). */
  utcOffset: '-03:00',
  utcOffsetMinutes: -180,
} as const;

/** Estados que ya no cambian. */
export const TERMINAL_STATUSES: readonly DteStatus[] = [
  'CERRADO',
  'CADUCADO',
  'SIN_ARRIBO',
  'RECHAZADO',
  'ANULADO',
  'ELIMINADO',
];

/** Dados de baja: no amparan el movimiento y dejan lugar a un DT-e nuevo. */
export const VOID_STATUSES: readonly DteStatus[] = ['ANULADO', 'ELIMINADO', 'RECHAZADO'];

/** Con numero oficial y abiertos: su estado efectivo depende del reloj. */
export const TIME_DRIVEN_STATUSES: readonly DteStatus[] = ['EMITIDO', 'VIGENTE', 'VENCIDO'];

export const isTerminal = (status: string): boolean =>
  TERMINAL_STATUSES.includes(status as DteStatus);

export const isVoid = (status: string): boolean => VOID_STATUSES.includes(status as DteStatus);

// ---------------------------------------------------------------------------
// Fechas en hora argentina
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDate = (value: string | null | undefined): value is string =>
  typeof value === 'string' &&
  ISO_DATE.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Dia calendario argentino (YYYY-MM-DD) de un instante. */
export const toArDate = (instant: Date): string =>
  new Date(instant.getTime() + DTE_RULES.utcOffsetMinutes * 60_000).toISOString().slice(0, 10);

export const addDays = (date: string, days: number): string => {
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
};

/** Dias calendario de `from` a `to` (positivo si `to` es posterior). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** 00:00:00.000 del dia argentino. */
export const startOfArDay = (date: string): Date =>
  new Date(`${date}T00:00:00.000${DTE_RULES.utcOffset}`);

/** 23:59:59.999 del dia argentino. */
export const endOfArDay = (date: string): Date =>
  new Date(`${date}T23:59:59.999${DTE_RULES.utcOffset}`);

// ---------------------------------------------------------------------------
// Ventana de transito y estado efectivo
// ---------------------------------------------------------------------------

export interface DteDates {
  loadDate: string | null;
  expiryDate: string | null;
}

export interface TransitWindow {
  /** Desde: 00:00 de la fecha de carga. */
  validFrom: Date;
  /** Hasta: 23:59 de la fecha de vencimiento. */
  validTo: Date;
  /** Fin del periodo de gracia: despues de esto, CADUCADO. */
  lapsesAt: Date;
  /** Ultimo dia en que la sala todavia puede cerrar (cierre extemporaneo). */
  lastClosingDate: string;
}

export const transitWindow = (dates: DteDates): TransitWindow | null => {
  if (!isIsoDate(dates.loadDate) || !isIsoDate(dates.expiryDate)) return null;
  const lastClosingDate = addDays(dates.expiryDate, DTE_RULES.graceDays);
  return {
    validFrom: startOfArDay(dates.loadDate),
    validTo: endOfArDay(dates.expiryDate),
    lapsesAt: endOfArDay(lastClosingDate),
    lastClosingDate,
  };
};

/**
 * Estado del DT-e en un instante dado (seccion 5.1).
 *
 * Solo los estados con numero oficial y abiertos dependen del reloj. Un
 * documento sin fechas (remitos y DT-e anteriores a la migracion 0001) conserva
 * su estado guardado: aplicarle vigencia seria inventar fechas que nadie cargo.
 */
export const effectiveStatus = (stored: string, dates: DteDates, at: Date): DteStatus => {
  const status = stored as DteStatus;
  if (!TIME_DRIVEN_STATUSES.includes(status)) return status;
  const window = transitWindow(dates);
  if (!window) return status;
  if (at < window.validFrom) return 'EMITIDO';
  if (at <= window.validTo) return 'VIGENTE';
  if (at <= window.lapsesAt) return 'VENCIDO';
  return 'CADUCADO';
};

const TIME_RANK: Record<string, number> = { EMITIDO: 0, VIGENTE: 1, VENCIDO: 2, CADUCADO: 3 };

/**
 * Transicion por paso del tiempo, solo hacia adelante. El barrido periodico
 * nunca "rejuvenece" un DT-e aunque alguien corrija el reloj del servidor.
 */
export const timeTransition = (stored: string, dates: DteDates, now: Date): DteStatus | null => {
  if (!TIME_DRIVEN_STATUSES.includes(stored as DteStatus)) return null;
  const next = effectiveStatus(stored, dates, now);
  return TIME_RANK[next] > TIME_RANK[stored] ? next : null;
};

/** Semaforo de transito (checklist 9): solo VIGENTE habilita la ruta. */
export const isAptForTransit = (stored: string, dates: DteDates, at: Date): boolean =>
  effectiveStatus(stored, dates, at) === 'VIGENTE';

// ---------------------------------------------------------------------------
// Validaciones del tramite
// ---------------------------------------------------------------------------

export interface RuleViolation {
  code: string;
  message: string;
}

/** Fecha de vencimiento por defecto: carga + 2 dias. */
export const defaultExpiryDate = (loadDate: string): string =>
  addDays(loadDate, DTE_RULES.defaultValidityDays);

/** Vencimiento entre 2 y 4 dias posteriores a la carga (seccion 4.1). */
export const validateValidity = (loadDate: string, expiryDate: string): RuleViolation | null => {
  const days = daysBetween(loadDate, expiryDate);
  if (days < DTE_RULES.minValidityDays || days > DTE_RULES.maxValidityDays) {
    return {
      code: 'VIGENCIA_FUERA_DE_RANGO',
      message: `La fecha de vencimiento debe estar entre ${DTE_RULES.minValidityDays} y ${DTE_RULES.maxValidityDays} dias despues de la fecha de carga (${loadDate}); se indicaron ${days}.`,
    };
  }
  return null;
};

/**
 * Anticipacion (seccion 4.2.3): SIGSA acepta la autogestion hasta 4 dias antes
 * de la fecha de carga y no para fechas pasadas. Aplica al pedir la emision,
 * no al preparar un borrador ni al registrar un DT-e que ya existe.
 */
export const validateAnticipation = (loadDate: string, now: Date): RuleViolation | null => {
  const today = toArDate(now);
  const ahead = daysBetween(today, loadDate);
  if (ahead < 0) {
    return {
      code: 'FECHA_CARGA_PASADA',
      message: `La fecha de carga (${loadDate}) ya paso. Corregila antes de solicitar la emision.`,
    };
  }
  if (ahead > DTE_RULES.maxAnticipationDays) {
    return {
      code: 'ANTICIPACION_EXCEDIDA',
      message: `SIGSA admite emitir hasta ${DTE_RULES.maxAnticipationDays} dias antes de la carga. Este DT-e se podra solicitar desde el ${addDays(loadDate, -DTE_RULES.maxAnticipationDays)}.`,
    };
  }
  return null;
};

/** Cantidad sugerida para declarar a partir de lo estimado (regla 4.2.1). */
export const suggestDeclaredQuantity = (estimated: number): number =>
  Math.max(estimated + 1, Math.ceil(estimated * DTE_RULES.overestimationFactor));

/**
 * La sala solo puede confirmar Qreal <= Qdeclarada (seccion 5.2). Si se supera,
 * no hay forma de corregirlo en el cierre: hay que anular y emitir otro DT-e.
 */
export const validateConfirmedQuantity = (
  declared: number | null,
  confirmed: number,
): RuleViolation | null => {
  if (declared === null || declared === undefined) return null;
  if (confirmed > declared) {
    return {
      code: 'EXCESO_CANTIDAD_DECLARADA',
      message: `La cantidad real de alzas (${confirmed}) supera la declarada en el DT-e (${declared}). Hay que anular este DT-e y emitir uno nuevo con al menos ${confirmed} alzas antes de descargar.`,
    };
  }
  return null;
};

// ---------------------------------------------------------------------------
// Formatos de identificadores (se advierten, no se imponen: son ejemplos de la
// especificacion y el formato definitivo lo confirma SENASA)
// ---------------------------------------------------------------------------

/** RENAPA del apiario: Letra-N°RENAPA-N°Apiario, ej. B53999-2. */
export const RENAPA_APIARY_PATTERN = /^[A-Z]\d{1,7}-\d{1,4}$/;

/** Sala de extraccion: SEF-Letra-N°, ej. SEF-B-20010. */
export const SALA_CODE_PATTERN = /^SEF-[A-Z]-\d{1,7}$/;

/** Numero de DT-e: prefijo de oficina y correlativo con verificador, ej. 022440451-4. */
export const DTE_NUMBER_PATTERN = /^\d{9}-\d$/;

export const normalizeCode = (value: string): string => value.trim().toUpperCase();

/** Patente sin espacios ni guiones, en mayusculas. "NO" y vacio significan sin acoplado. */
export const normalizePlate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const clean = value.toUpperCase().replace(/[\s.\-]/g, '');
  if (!clean || clean === 'NO' || clean === 'SIN') return null;
  return clean;
};

/** Formatos vigentes en Argentina: AAA999 (anterior) y AA999AA (Mercosur). */
export const isArgentinePlate = (plate: string): boolean =>
  /^[A-Z]{3}\d{3}$/.test(plate) || /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(plate);

export const TRANSPORT_TYPES = ['CAMION', 'CAMIONETA', 'FURGON', 'UTILITARIO', 'OTRO'] as const;
export type TransportType = (typeof TRANSPORT_TYPES)[number];

// ---------------------------------------------------------------------------
// Avisos por estado: lo que el usuario tiene que saber o hacer
// ---------------------------------------------------------------------------

export interface DteAlert {
  code: string;
  severity: 'info' | 'success' | 'warning' | 'danger';
  message: string;
}

export interface AlertInput extends DteDates {
  status: string;
  issueMode: string;
  syncStatus: string;
  errorMessage: string | null;
  regularizedAt: Date | null;
}

export const alertsFor = (dte: AlertInput, now: Date): DteAlert[] => {
  const alerts: DteAlert[] = [];
  const status = effectiveStatus(dte.status, dte, now);
  const window = transitWindow(dte);
  const today = toArDate(now);

  if (dte.issueMode === 'SIMULADO') {
    alerts.push({
      code: 'SIMULADO',
      severity: 'warning',
      message: 'Emision simulada: sin validez oficial. No sirve para transitar.',
    });
  }

  switch (status) {
    case 'BORRADOR': {
      if (dte.loadDate) {
        const opensOn = addDays(dte.loadDate, -DTE_RULES.maxAnticipationDays);
        if (daysBetween(today, opensOn) > 0) {
          alerts.push({
            code: 'BORRADOR_ANTICIPADO',
            severity: 'info',
            message: `Borrador listo. SIGSA lo acepta desde el ${opensOn}.`,
          });
        } else if (daysBetween(today, dte.loadDate) < 0) {
          alerts.push({
            code: 'BORRADOR_VENCIDO',
            severity: 'warning',
            message: 'La fecha de carga del borrador ya paso: actualizala o eliminalo.',
          });
        } else {
          alerts.push({
            code: 'BORRADOR_PENDIENTE',
            severity: 'info',
            message: 'Borrador: falta emitir el DT-e.',
          });
        }
      }
      break;
    }
    case 'SOLICITADO':
      alerts.push(
        dte.syncStatus === 'ERROR'
          ? {
              code: 'SOLICITUD_CON_ERROR',
              severity: 'danger',
              message: `No se pudo enviar a SIGSA: ${dte.errorMessage ?? 'error de comunicacion'}. Se reintenta solo.`,
            }
          : {
              code: 'SOLICITUD_EN_CURSO',
              severity: 'info',
              message: 'Solicitud enviada a SIGSA. Esperando el numero de DT-e.',
            },
      );
      break;
    case 'EMITIDO':
      alerts.push({
        code: 'NO_TRANSITAR',
        severity: 'warning',
        message: `Todavia no se puede transitar: el DT-e se habilita el ${dte.loadDate} a las 00:00.`,
      });
      break;
    case 'VIGENTE':
      alerts.push(
        dte.expiryDate === today
          ? {
              code: 'VENCE_HOY',
              severity: 'warning',
              message: 'Vence hoy a las 23:59. Llevalo impreso en la cabina.',
            }
          : {
              code: 'APTO_TRANSITO',
              severity: 'success',
              message: `Apto para transitar hasta el ${dte.expiryDate} a las 23:59. Llevalo impreso en la cabina.`,
            },
      );
      break;
    case 'VENCIDO':
      alerts.push({
        code: 'VENCIDO_SIN_CIERRE',
        severity: 'danger',
        message: `Vencido sin cierre. La sala puede cerrarlo hasta el ${window?.lastClosingDate}; despues caduca y SIGSA bloquea al productor.`,
      });
      break;
    case 'CADUCADO':
      if (!dte.regularizedAt) {
        alerts.push({
          code: 'CADUCADO_BLOQUEO',
          severity: 'danger',
          message:
            'Caducado: SIGSA bloquea al productor para emitir nuevos DT-e hasta regularizar ante SENASA.',
        });
      }
      break;
    default:
      break;
  }

  return alerts;
};
