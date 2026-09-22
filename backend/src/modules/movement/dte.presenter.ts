import type { AuthenticatedUser } from '../../common/types';
import {
  alertsFor,
  effectiveStatus,
  transitWindow,
  type DteAlert,
  type DteStatus,
} from './dte.rules';
import type { DteRow } from './dte.queries';

/**
 * El codigo de cierre es la "llave" con la que la sala demuestra, en SITA, que
 * tiene el DT-e impreso en la mano. Si la plataforma se lo mostrara a la sala,
 * el control no probaria nada: solo lo ve quien emite (y el administrador).
 */
export const canSeeVerificationCode = (
  row: Pick<DteRow, 'issuerOrganizationId'>,
  actor: AuthenticatedUser,
): boolean =>
  actor.role === 'ADMIN' ||
  (actor.organizationId !== null && actor.organizationId === row.issuerOrganizationId);

export interface PresentedDte extends Omit<DteRow, 'status' | 'verificationCode'> {
  /** Estado efectivo en este instante: ya contempla la vigencia. */
  status: DteStatus;
  /** Estado persistido; puede ir detras del reloj hasta el proximo barrido. */
  storedStatus: DteStatus;
  verificationCode: string | null;
  hasVerificationCode: boolean;
  isApiSem: boolean;
  /** Semaforo de transito: solo VIGENTE habilita la ruta. */
  aptForTransit: boolean;
  window: {
    validFrom: string;
    validTo: string;
    lapsesAt: string;
    lastClosingDate: string;
  } | null;
  alerts: DteAlert[];
}

export const presentDte = (
  row: DteRow,
  actor: AuthenticatedUser,
  now: Date = new Date(),
): PresentedDte => {
  const status = effectiveStatus(row.status, row, now);
  const window = transitWindow(row);
  const { verificationCode, status: storedStatus, ...rest } = row;
  return {
    ...rest,
    status,
    storedStatus: storedStatus as DteStatus,
    verificationCode: canSeeVerificationCode(row, actor) ? verificationCode : null,
    hasVerificationCode: Boolean(verificationCode),
    isApiSem: row.movementTypeCode === 'API-SEM',
    aptForTransit: status === 'VIGENTE',
    window: window
      ? {
          validFrom: window.validFrom.toISOString(),
          validTo: window.validTo.toISOString(),
          lapsesAt: window.lapsesAt.toISOString(),
          lastClosingDate: window.lastClosingDate,
        }
      : null,
    alerts: alertsFor(
      {
        status: row.status,
        loadDate: row.loadDate,
        expiryDate: row.expiryDate,
        issueMode: row.issueMode,
        syncStatus: row.syncStatus,
        errorMessage: row.errorMessage,
        regularizedAt: row.regularizedAt,
      },
      now,
    ),
  };
};
