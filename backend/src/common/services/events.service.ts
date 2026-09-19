import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { outboxEvent, traceabilityEvent } from '../../database/schema';
import type { DbExecutor } from './types';

/**
 * Catalogo de eventos de dominio (arquitectura, seccion 27).
 * Mantenerlo cerrado evita que cada modulo invente nombres divergentes.
 */
export const DomainEvents = {
  ProducerRegistered: 'ProducerRegistered',
  RenapaAssociated: 'RenapaAssociated',
  EstablishmentRegistered: 'EstablishmentRegistered',
  RenspaAssociated: 'RenspaAssociated',
  ApiaryRegistered: 'ApiaryRegistered',
  HiveRegistered: 'HiveRegistered',
  MovementCreated: 'MovementCreated',
  MovementDispatched: 'MovementDispatched',
  MovementReceived: 'MovementReceived',
  MovementRejected: 'MovementRejected',
  MovementCancelled: 'MovementCancelled',
  DteCreated: 'DteCreated',
  DteRequested: 'DteRequested',
  DteIssued: 'DteIssued',
  DteApproved: 'DteApproved',
  DteBecameValid: 'DteBecameValid',
  DteExpired: 'DteExpired',
  DteLapsed: 'DteLapsed',
  DteClosed: 'DteClosed',
  DteVoided: 'DteVoided',
  DteNoArrival: 'DteNoArrival',
  DteRegularized: 'DteRegularized',
  DteRejected: 'DteRejected',
  ExtractionRegistered: 'ExtractionRegistered',
  ExtractionCompleted: 'ExtractionCompleted',
  LotCreated: 'LotCreated',
  LotInputAdded: 'LotInputAdded',
  LotClosed: 'LotClosed',
  LotTransformed: 'LotTransformed',
  DrumCreated: 'DrumCreated',
  DrumMoved: 'DrumMoved',
  SampleCreated: 'SampleCreated',
  InventoryMoved: 'InventoryMoved',
} as const;

export type DomainEventType = (typeof DomainEvents)[keyof typeof DomainEvents];

export interface DomainEventInput {
  eventType: DomainEventType;
  entityType: string;
  entityId: string;
  actorUserId?: string | null;
  organizationId?: string | null;
  correlationId?: string | null;
  occurredAt?: Date;
  payload?: Record<string, unknown>;
  recordInTimeline?: boolean;
}

/**
 * Publica eventos de dominio en dos destinos, dentro de la misma transaccion
 * que la escritura de negocio:
 *   1. traceability_event -> historial inmutable consultable (CU-19).
 *   2. outbox_event       -> entrega asincrona (auditoria, notificaciones,
 *                            adaptadores SENASA/ARCA/SIFeGA).
 * Cuando se incorpore RabbitMQ o Kafka solo cambia el despachador del outbox:
 * los servicios de dominio no se modifican.
 */
@Injectable()
export class EventsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async publish(event: DomainEventInput, executor: DbExecutor = this.db): Promise<void> {
    const occurredAt = event.occurredAt ?? new Date();
    const payload = event.payload ?? {};

    if (event.recordInTimeline !== false) {
      await executor.insert(traceabilityEvent).values({
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        occurredAt,
        actorUserId: event.actorUserId ?? null,
        organizationId: event.organizationId ?? null,
        correlationId: event.correlationId ?? null,
        payload: payload as never,
      });
    }

    await executor.insert(outboxEvent).values({
      eventType: event.eventType,
      aggregateType: event.entityType,
      aggregateId: event.entityId,
      payload: { ...payload, occurredAt: occurredAt.toISOString() } as never,
      correlationId: event.correlationId ?? null,
    });
  }

  async publishMany(events: DomainEventInput[], executor: DbExecutor = this.db): Promise<void> {
    for (const event of events) {
      await this.publish(event, executor);
    }
  }

  /** Timeline de una entidad (CU-19). */
  async timeline(entityType: string, entityId: string, limit = 200) {
    return this.db
      .select()
      .from(traceabilityEvent)
      .where(
        and(eq(traceabilityEvent.entityType, entityType), eq(traceabilityEvent.entityId, entityId)),
      )
      .orderBy(asc(traceabilityEvent.createdAt))
      .limit(limit);
  }

  async search(filters: { eventType?: string; entityType?: string; page: number; pageSize: number }) {
    const conditions: SQL[] = [];
    if (filters.eventType) conditions.push(eq(traceabilityEvent.eventType, filters.eventType));
    if (filters.entityType) conditions.push(eq(traceabilityEvent.entityType, filters.entityType));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(traceabilityEvent)
        .where(where)
        .orderBy(desc(traceabilityEvent.occurredAt))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(traceabilityEvent)
        .where(where),
    ]);
    return { rows, total: count };
  }
}
