import {
  SenasaUnavailableError,
  type DteEmissionResult,
  type RegistryLookup,
  type SenasaGateway,
} from './senasa.gateway';

/**
 * Modo sin integracion. Es el comportamiento honesto mientras SENASA no
 * habilite su API: el DT-e se emite en SIGSA (web u oficina local) y en
 * ApiTrace se registra el numero y el codigo de cierre que figuran impresos.
 */
export class ManualSenasaGateway implements SenasaGateway {
  readonly mode = 'manual' as const;
  readonly environment = 'local' as const;
  readonly capabilities = { emit: false, void: false, close: false, registryLookup: false };
  readonly description =
    'Sin integracion con SENASA: el DT-e se emite en SIGSA y en ApiTrace se registra su numero.';

  async lookupApiary(): Promise<RegistryLookup | null> {
    return null;
  }

  async lookupSala(): Promise<RegistryLookup | null> {
    return null;
  }

  async emitDte(): Promise<DteEmissionResult> {
    throw this.unavailable();
  }

  async voidDte(): Promise<void> {
    // Nada que sincronizar: la anulacion se hace en SIGSA y se refleja aca.
  }

  async closeDte(): Promise<void> {
    // El cierre se hace en SITA; ApiTrace solo lo registra.
  }

  async reportNoArrival(): Promise<void> {
    // Idem: la declaracion de "sin arribo" se hace en SITA.
  }

  private unavailable(): SenasaUnavailableError {
    return new SenasaUnavailableError(
      'MODO_MANUAL',
      'La emision por API no esta habilitada. Emiti el DT-e en SIGSA y registra su numero.',
    );
  }
}
