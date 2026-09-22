/**
 * Puerto de integracion con SENASA (anti-corruption layer).
 *
 * El dominio de ApiTrace habla en sus propios terminos (DT-e, apiario, sala) y
 * esta interfaz traduce hacia SIGSA/SITA. Hay tres adaptadores:
 *
 *   manual    sin integracion: el usuario emite en SIGSA y transcribe el numero.
 *   simulado  respuestas de prueba sin validez oficial, para demos y QA.
 *   sigsa     API oficial de SENASA. Queda como esqueleto hasta contar con el
 *             contrato y las credenciales (ver
 *             docs/plan-dte/10-API-Integracion-SENASA-ApiTrace.md).
 *
 * Cambiar de adaptador es cambiar SENASA_MODE: ni los servicios de dominio ni
 * la base de datos se enteran.
 */

export const SENASA_GATEWAY = Symbol('SENASA_GATEWAY');

export type SenasaMode = 'manual' | 'simulado' | 'sigsa';
export type SenasaEnvironment = 'local' | 'homologacion' | 'produccion';

export interface SenasaCapabilities {
  /** Solicitar la emision de un DT-e por API. */
  emit: boolean;
  /** Anular o eliminar un DT-e por API. */
  void: boolean;
  /** Cerrar el DT-e en SITA por API (sala). */
  close: boolean;
  /** Consultar padrones (RENAPA de apiarios, salas habilitadas). */
  registryLookup: boolean;
}

export interface RegistryLookup {
  code: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED' | 'NOT_FOUND';
  validTo?: string | null;
  holderTaxId?: string | null;
  detail?: string;
}

export interface DteEmissionRequest {
  /** Referencia propia e idempotente: el id del DT-e en ApiTrace. */
  externalReference: string;
  holderTaxId: string | null;
  movementTypeCode: string;
  transitReason: string;
  originCode: string;
  destinationCode: string;
  productCode: string;
  unit: string;
  declaredQuantity: number;
  loadDate: string;
  expiryDate: string;
  transport: { type: string | null; plate: string | null; trailerPlate: string | null };
  /** Estado local de los registros; el simulador lo usa para reproducir rechazos de SIGSA. */
  localRegistry?: { originStatus: string | null; destinationStatus: string | null };
}

export interface DteEmissionResult {
  number: string;
  verificationCode: string;
  issuedAt: Date;
  externalId: string;
  externalStatus: string;
  pdfUrl?: string | null;
}

export interface DteCloseRequest {
  number: string;
  verificationCode: string | null;
  arrivalAt: Date;
  confirmedQuantity: number | null;
}

/** Rechazo definitivo del organismo (dato invalido, registro inhabilitado). No se reintenta. */
export class SenasaBusinessError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SenasaBusinessError';
  }
}

/** Falla tecnica o integracion no disponible. El outbox reintenta con backoff. */
export class SenasaUnavailableError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SenasaUnavailableError';
  }
}

export interface SenasaGateway {
  readonly mode: SenasaMode;
  readonly environment: SenasaEnvironment;
  readonly capabilities: SenasaCapabilities;
  /** Texto para mostrar al usuario: que puede y que no puede hacer este modo. */
  readonly description: string;

  /** Estado del apiario en RENAPA. null si el adaptador no consulta padrones. */
  lookupApiary(code: string, holderTaxId: string | null): Promise<RegistryLookup | null>;
  /** Estado de la sala de extraccion. null si el adaptador no consulta padrones. */
  lookupSala(code: string): Promise<RegistryLookup | null>;

  emitDte(request: DteEmissionRequest): Promise<DteEmissionResult>;
  voidDte(input: {
    number: string;
    externalId: string | null;
    reason: string;
    feePaid: boolean;
  }): Promise<void>;
  closeDte(input: DteCloseRequest): Promise<void>;
  reportNoArrival(input: { number: string; reason: string }): Promise<void>;
}
