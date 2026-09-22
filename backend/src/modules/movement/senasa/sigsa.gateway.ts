import {
  SenasaUnavailableError,
  type DteEmissionResult,
  type RegistryLookup,
  type SenasaEnvironment,
  type SenasaGateway,
} from './senasa.gateway';

export interface SigsaGatewayConfig {
  environment: Exclude<SenasaEnvironment, 'local'>;
  baseUrl: string | null;
  platformTaxId: string | null;
  timeoutMs: number;
}

/**
 * Adaptador de la API oficial de SENASA (SIGSA para emitir, SITA para cerrar).
 *
 * Esqueleto deliberado: la especificacion describe el circuito funcional, pero
 * SENASA todavia no entrego el contrato tecnico (endpoints, esquema, mecanismo
 * de autenticacion). Implementar sobre supuestos generaria un adaptador que
 * habria que reescribir. El contrato que ApiTrace necesita esta definido en
 * `docs/plan-dte/10-API-Integracion-SENASA-ApiTrace.md` y en
 * `docs/plan-dte/openapi-apitrace-senasa.yaml`; cada metodo indica la operacion
 * que lo implementara.
 *
 * Mientras tanto declara todas sus capacidades en false: el servicio de dominio
 * no ofrece la emision por API y el usuario ve un mensaje claro, en lugar de un
 * error tecnico en la cola.
 */
export class SigsaSenasaGateway implements SenasaGateway {
  readonly mode = 'sigsa' as const;
  readonly capabilities = { emit: false, void: false, close: false, registryLookup: false };
  readonly description: string;

  constructor(private readonly config: SigsaGatewayConfig) {
    this.description = `Integracion oficial SIGSA (${config.environment}) pendiente del contrato de SENASA.`;
  }

  get environment(): SenasaEnvironment {
    return this.config.environment;
  }

  /** Operacion requerida: GET /padrones/renapa/apiarios/{codigo} (seccion 6.2 del doc 10). */
  async lookupApiary(): Promise<RegistryLookup | null> {
    return null;
  }

  /** Operacion requerida: GET /padrones/salas-extraccion/{codigo} (seccion 6.2 del doc 10). */
  async lookupSala(): Promise<RegistryLookup | null> {
    return null;
  }

  /** Operacion requerida: POST /dte/api-sem (seccion 6.3 del doc 10). */
  async emitDte(): Promise<DteEmissionResult> {
    throw this.pending('emitir DT-e');
  }

  /** Operacion requerida: POST /dte/{numero}/anulacion (seccion 6.3 del doc 10). */
  async voidDte(): Promise<void> {
    throw this.pending('anular DT-e');
  }

  /** Operacion requerida: POST /sita/dte/{numero}/cierre (seccion 6.4 del doc 10). */
  async closeDte(): Promise<void> {
    throw this.pending('cerrar DT-e en SITA');
  }

  /** Operacion requerida: POST /sita/dte/{numero}/sin-arribo (seccion 6.4 del doc 10). */
  async reportNoArrival(): Promise<void> {
    throw this.pending('declarar sin arribo');
  }

  private pending(operation: string): SenasaUnavailableError {
    return new SenasaUnavailableError(
      'SIGSA_NO_DISPONIBLE',
      `No es posible ${operation}: la API oficial de SENASA todavia no esta disponible para ApiTrace.`,
    );
  }
}
