import { createHash } from 'node:crypto';
import {
  SenasaBusinessError,
  type DteCloseRequest,
  type DteEmissionRequest,
  type DteEmissionResult,
  type RegistryLookup,
  type SenasaGateway,
} from './senasa.gateway';

/**
 * Simulador de SIGSA/SITA.
 *
 * Sirve para demostrar y probar el circuito completo (solicitud asincrona,
 * numero, codigo de cierre, rechazos) sin credenciales oficiales. Todo lo que
 * produce lleva el prefijo SIM- y el DT-e queda marcado como SIMULADO: un numero
 * simulado nunca debe confundirse con uno real ni usarse para transitar.
 *
 * Es determinista: la misma referencia produce el mismo numero y el mismo
 * codigo, igual que un servicio idempotente. Un reintento del outbox no genera
 * un segundo DT-e.
 */
export class SimulatedSenasaGateway implements SenasaGateway {
  readonly mode = 'simulado' as const;
  readonly environment = 'local' as const;
  readonly capabilities = { emit: true, void: true, close: true, registryLookup: false };
  readonly description =
    'Simulacion de SIGSA: el circuito es completo pero los numeros no tienen validez oficial.';

  async lookupApiary(): Promise<RegistryLookup | null> {
    return null;
  }

  async lookupSala(): Promise<RegistryLookup | null> {
    return null;
  }

  async emitDte(request: DteEmissionRequest): Promise<DteEmissionResult> {
    // Las mismas precondiciones que SIGSA verifica antes de emitir (seccion 4.2.2).
    if (!request.originCode) {
      throw new SenasaBusinessError('ORIGEN_REQUERIDO', 'Falta el RENAPA del apiario de origen.');
    }
    if (!request.destinationCode) {
      throw new SenasaBusinessError('DESTINO_REQUERIDO', 'Falta el codigo de la sala de destino.');
    }
    const origin = request.localRegistry?.originStatus;
    if (origin && !['ACTIVE', 'PENDING_VERIFICATION'].includes(origin)) {
      throw new SenasaBusinessError(
        'ORIGEN_NO_HABILITADO',
        `El apiario ${request.originCode} no esta habilitado en RENAPA (${origin}).`,
      );
    }
    const destination = request.localRegistry?.destinationStatus;
    if (destination && !['ACTIVE', 'PENDING_VERIFICATION'].includes(destination)) {
      throw new SenasaBusinessError(
        'DESTINO_NO_HABILITADO',
        `La sala ${request.destinationCode} no esta habilitada (${destination}).`,
      );
    }
    if (!request.holderTaxId) {
      throw new SenasaBusinessError('TITULAR_SIN_CUIT', 'El titular del apiario no tiene CUIT.');
    }

    const digest = createHash('sha256').update(request.externalReference).digest('hex');
    const body = String(Number.parseInt(digest.slice(0, 12), 16) % 1_000_000_000).padStart(9, '0');
    const check =
      [...body].reduce((sum, digit, index) => sum + Number(digit) * (index + 2), 0) % 10;
    const code = String(Number.parseInt(digest.slice(12, 20), 16) % 1_000_000).padStart(6, '0');

    return {
      number: `SIM-${body}-${check}`,
      verificationCode: code,
      issuedAt: new Date(),
      externalId: `SIM-${request.externalReference}`,
      externalStatus: 'EMITIDO',
      pdfUrl: null,
    };
  }

  async voidDte(input: { number: string }): Promise<void> {
    this.assertSimulated(input.number);
  }

  async closeDte(input: DteCloseRequest): Promise<void> {
    this.assertSimulated(input.number);
  }

  async reportNoArrival(input: { number: string }): Promise<void> {
    this.assertSimulated(input.number);
  }

  /** El simulador no toca documentos reales: un numero sin prefijo SIM- no es suyo. */
  private assertSimulated(number: string): void {
    if (!number.startsWith('SIM-')) {
      throw new SenasaBusinessError(
        'NO_SIMULADO',
        `El DT-e ${number} no fue emitido por el simulador; su gestion se hace en SIGSA.`,
      );
    }
  }
}
