import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DRIZZLE, type Database } from '../../database/database.module';
import { integrationEvent } from '../../database/schema';

export interface IntegrationLogInput {
  system: 'SENASA_SIGSA' | 'SENASA_RENSPA' | 'SENASA_RENAPA' | 'ARCA' | 'SIFEGA' | 'LABORATORIO';
  operation: string;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'SKIPPED';
  requestId?: string | null;
  externalId?: string | null;
  request?: unknown;
  response?: unknown;
  httpStatus?: number | null;
  latencyMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  correlationId?: string | null;
}

/**
 * Bitacora de comunicaciones con organismos (arquitectura, seccion 50).
 *
 * Guarda hashes del pedido y la respuesta, no su contenido: alcanza para probar
 * que se envio y que se recibio sin copiar datos personales a otra tabla. Igual
 * que la auditoria, nunca hace fallar la operacion que registra.
 */
@Injectable()
export class IntegrationLogService {
  private readonly logger = new Logger(IntegrationLogService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async record(input: IntegrationLogInput): Promise<void> {
    try {
      await this.db.insert(integrationEvent).values({
        system: input.system,
        operation: input.operation.slice(0, 120),
        requestId: input.requestId ?? null,
        externalId: input.externalId ?? null,
        requestHash: input.request === undefined ? null : this.hash(input.request),
        responseHash: input.response === undefined ? null : this.hash(input.response),
        status: input.status,
        httpStatus: input.httpStatus ?? null,
        latencyMs: input.latencyMs ?? null,
        errorCode: input.errorCode?.slice(0, 80) ?? null,
        errorMessage: input.errorMessage?.slice(0, 1000) ?? null,
        correlationId: input.correlationId ?? null,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la integracion ${input.system}/${input.operation}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private hash(value: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(value ?? null))
      .digest('hex');
  }
}
