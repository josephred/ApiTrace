import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, lte, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { outboxEvent } from '../../database/schema';

export interface OutboxMessage {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  correlationId: string | null;
}

export type OutboxHandler = (message: OutboxMessage) => Promise<void>;

/**
 * Despachador del outbox. En el MVP entrega en proceso; su unica razon de ser
 * es aislar al dominio del transporte, de modo que incorporar RabbitMQ o Kafka
 * (arquitectura, seccion 26) sea reemplazar esta clase y nada mas.
 *
 * SKIP LOCKED permite correr varias instancias del web service sin duplicar
 * entregas, algo necesario apenas Render escale horizontalmente.
 */
@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private readonly handlers = new Map<string, OutboxHandler[]>();
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('outbox.enabled')) {
      this.logger.warn('Outbox deshabilitado por configuracion.');
      return;
    }
    const interval = this.config.get<number>('outbox.intervalMs') ?? 5000;
    this.timer = setInterval(() => {
      void this.drain();
    }, interval);
    this.timer.unref();
    this.logger.log(`Outbox activo (intervalo ${interval}ms).`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Suscribe un handler a un tipo de evento. Los adaptadores externos se enganchan aqui. */
  subscribe(eventType: string, handler: OutboxHandler): void {
    const current = this.handlers.get(eventType) ?? [];
    current.push(handler);
    this.handlers.set(eventType, current);
  }

  async drain(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const batchSize = this.config.get<number>('outbox.batchSize') ?? 50;
      const maxAttempts = this.config.get<number>('outbox.maxAttempts') ?? 5;

      const claimed = await this.db.execute<{
        id: string;
        event_type: string;
        aggregate_type: string;
        aggregate_id: string;
        payload: unknown;
        correlation_id: string | null;
      }>(sql`
        UPDATE outbox_event
        SET status = 'PROCESSING', attempts = attempts + 1
        WHERE id IN (
          SELECT id FROM outbox_event
          WHERE status = 'PENDING' AND available_at <= now()
          ORDER BY available_at ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, event_type, aggregate_type, aggregate_id, payload, correlation_id
      `);

      const rows = claimed.rows ?? [];
      for (const row of rows) {
        const message: OutboxMessage = {
          id: row.id,
          eventType: row.event_type,
          aggregateType: row.aggregate_type,
          aggregateId: row.aggregate_id,
          payload: row.payload,
          correlationId: row.correlation_id,
        };
        try {
          for (const handler of this.handlers.get(message.eventType) ?? []) {
            await handler(message);
          }
          await this.db
            .update(outboxEvent)
            .set({ status: 'PROCESSED', processedAt: new Date(), lastError: null })
            .where(eq(outboxEvent.id, message.id));
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Fallo entregando ${message.eventType} (${message.id}): ${reason}`);
          await this.db
            .update(outboxEvent)
            .set({
              status: sql`CASE WHEN attempts >= ${maxAttempts} THEN 'FAILED'::outbox_status ELSE 'PENDING'::outbox_status END`,
              // Backoff exponencial acotado: 2^intentos minutos.
              availableAt: sql`now() + (LEAST(power(2, attempts), 60) * interval '1 minute')`,
              lastError: reason.slice(0, 1000),
            })
            .where(eq(outboxEvent.id, message.id));
        }
      }
      return rows.length;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Error al consultar outbox_event (se reintentará): ${msg}`);
      return 0;
    } finally {
      this.running = false;
    }
  }

  /** Devuelve pendientes vencidos: util para health checks y metricas. */
  async pendingCount(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(outboxEvent)
      .where(and(eq(outboxEvent.status, 'PENDING'), lte(outboxEvent.availableAt, new Date())));
    return result[0]?.count ?? 0;
  }
}
