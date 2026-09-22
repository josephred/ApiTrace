import type {
  apiary,
  establishment,
  movement,
  producer,
  renapaRegistration,
} from '../../database/schema';

export type MovementRow = typeof movement.$inferSelect;
export type EstablishmentRow = typeof establishment.$inferSelect;
export type ApiaryRow = typeof apiary.$inferSelect;
export type ProducerRow = typeof producer.$inferSelect;
export type RenapaRow = typeof renapaRegistration.$inferSelect;

export type DteCheckStatus = 'ok' | 'info' | 'warning' | 'error';

/** Resultado de una verificacion previa (checklist 9 de la especificacion). */
export interface DteCheck {
  code: string;
  label: string;
  status: DteCheckStatus;
  message: string;
}

/** Todo lo que hace falta saber de los extremos para emitir o validar un DT-e. */
export interface DteContext {
  origin: EstablishmentRow;
  destination: EstablishmentRow;
  apiary: ApiaryRow | null;
  holder: ProducerRow | null;
  holderRenapa: RenapaRow | null;
}

/** Datos del tramite API-SEM que la persona puede editar mientras es borrador. */
export interface DraftData {
  estimatedQuantity: number | null;
  declaredQuantity: number | null;
  loadDate: string;
  expiryDate: string;
  transportType: string | null;
  transportPlate: string | null;
  transportTrailerPlate: string | null;
}

/** Acciones que la pantalla puede ofrecer; las calcula el backend (DteQueryService). */
export type DteAction =
  | 'edit'
  | 'issueManual'
  | 'requestEmission'
  | 'void'
  | 'close'
  | 'noArrival'
  | 'regularize'
  | 'print';
