import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DRIZZLE, type Database } from '../../database/database.module';
import { integrationEvent } from '../../database/schema';
import type { DbExecutor } from './types';

export interface RecordIntegrationInput {
  system:
    | 'MANUAL'
    | 'SENASA_SIGSA'
    | 'SENASA_RENSPA'
    | 'SENASA_RENAPA'
    | 'ARCA'
    | 'SIFEGA'
    | 'LABORATORIO';
  operation: string;
  requestId?: string | null;
  externalId?: string | null;
  requestPayload?: unknown;
  responsePayload?: unknown;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'SKIPPED';
  httpStatus?: number | null;
  latencyMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  correlationId?: string | null;
  occurredAt?: Date;
}

@Injectable()
export class IntegrationLogService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  hash(data: unknown): string | undefined {
    if (data === undefined || data === null) return undefined;
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return createHash('sha256').update(str).digest('hex');
  }

  async record(input: RecordIntegrationInput, executor: DbExecutor = this.db): Promise<void> {
    const requestHash = this.hash(input.requestPayload);
    const responseHash = this.hash(input.responsePayload);

    await executor.insert(integrationEvent).values({
      system: input.system,
      operation: input.operation,
      requestId: input.requestId ?? null,
      externalId: input.externalId ?? null,
      requestHash: requestHash ?? null,
      responseHash: responseHash ?? null,
      status: input.status,
      httpStatus: input.httpStatus ?? null,
      latencyMs: input.latencyMs ?? null,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ? input.errorMessage.slice(0, 1000) : null,
      correlationId: input.correlationId ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    });
  }
}
