import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { dte } from '../../database/schema';
import { DomainEvents, EventsService } from '../../common/services/events.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import {
  OutboxDispatcher,
  type OutboxMessage,
} from '../../common/services/outbox-dispatcher.service';
import { DteQueries, type DteRow } from './dte.queries';
import { DteChecksService } from './dte-checks.service';
import { effectiveStatus } from './dte.rules';
import {
  SENASA_GATEWAY,
  SenasaBusinessError,
  type DteEmissionRequest,
  type SenasaGateway,
} from './senasa/senasa.gateway';

/**
 * Entrega a SENASA lo que el dominio ya decidio (arquitectura, secciones 26 y 53).
 *
 * Escucha el outbox: DteRequested (emitir), DteVoided (anular), DteClosed
 * (cerrar en SITA) y DteNoArrival. Reglas:
 *   - un rechazo de negocio (SenasaBusinessError) es definitivo: no se reintenta;
 *   - una falla tecnica se relanza para que el outbox reintente con backoff;
 *   - toda llamada queda en integration_event, con exito o sin el;
 *   - un DT-e emitido por un canal solo se sincroniza por ese mismo canal (un
 *     numero SIM- nunca viaja a SIGSA real, ni al reves).
 */
@Injectable()
export class DteSyncWorker implements OnModuleInit {
  private readonly logger = new Logger(DteSyncWorker.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly outbox: OutboxDispatcher,
    private readonly queries: DteQueries,
    private readonly checks: DteChecksService,
    private readonly events: EventsService,
    private readonly integrations: IntegrationLogService,
    @Inject(SENASA_GATEWAY) private readonly gateway: SenasaGateway,
  ) {}

  onModuleInit(): void {
    this.outbox.subscribe(DomainEvents.DteRequested, (message) => this.onRequested(message));
    this.outbox.subscribe(DomainEvents.DteVoided, (message) => this.onVoided(message));
    this.outbox.subscribe(DomainEvents.DteClosed, (message) => this.onClosed(message));
    this.outbox.subscribe(DomainEvents.DteNoArrival, (message) => this.onNoArrival(message));
  }

  // -------------------------------------------------------------------------
  // Emision
  // -------------------------------------------------------------------------

  async onRequested(message: OutboxMessage): Promise<void> {
    const row = await this.rowOf(message);
    if (!row) return;
    // Anulado mientras esperaba en la cola: no se pide nada.
    if (row.status !== 'SOLICITADO') return;

    if (!this.sameChannel(row) || !this.gateway.capabilities.emit) {
      await this.markSyncError(
        row,
        'CANAL_NO_DISPONIBLE',
        `El canal ${row.issueMode} no esta disponible en el modo actual (${this.gateway.mode}).`,
      );
      return;
    }

    const ctx = await this.checks.contextForRow(row);
    const request: DteEmissionRequest = {
      externalReference: row.id,
      holderTaxId: row.holderTaxId,
      movementTypeCode: row.movementTypeCode ?? 'API-SEM',
      transitReason: row.transitReason ?? '',
      originCode: row.originCode ?? '',
      destinationCode: row.destinationCode ?? '',
      productCode: row.productCode ?? '',
      unit: row.unit ?? 'UNIDAD',
      declaredQuantity: row.declaredQuantity ?? 0,
      loadDate: row.loadDate ?? '',
      expiryDate: row.expiryDate ?? '',
      transport: {
        type: row.transportType,
        plate: row.transportPlate,
        trailerPlate: row.transportTrailerPlate,
      },
      localRegistry: {
        originStatus: ctx.apiary?.renapaStatus ?? null,
        destinationStatus: ctx.destination.senasaStatus ?? null,
      },
    };

    const started = Date.now();
    try {
      const result = await this.gateway.emitDte(request);
      await this.integrations.record({
        system: 'SENASA_SIGSA',
        operation: 'DTE_EMITIR',
        status: 'SUCCESS',
        requestId: row.id,
        externalId: result.externalId,
        request,
        response: result,
        latencyMs: Date.now() - started,
        correlationId: message.correlationId,
      });

      const now = new Date();
      const next = effectiveStatus('EMITIDO', row, now);
      const issued = await this.db.transaction(async (tx) => {
        const [saved] = await tx
          .update(dte)
          .set({
            status: next,
            number: result.number,
            verificationCode: result.verificationCode,
            issuedAt: result.issuedAt,
            externalId: result.externalId,
            externalStatus: result.externalStatus,
            pdfUrl: result.pdfUrl ?? null,
            syncStatus: 'SYNCHRONIZED',
            lastSyncAt: now,
            errorCode: null,
            errorMessage: null,
            updatedAt: now,
          })
          .where(and(eq(dte.id, row.id), eq(dte.status, 'SOLICITADO')))
          .returning();
        if (!saved) return null;

        await this.queries.updateDocumentNumber(tx, saved);
        await this.queries.recordTransition(tx, {
          dteId: row.id,
          from: 'SOLICITADO',
          to: 'EMITIDO',
          source: 'SENASA',
          reason: `${row.issueMode === 'SIMULADO' ? 'Simulador' : 'SIGSA'} emitio el DT-e ${result.number}.`,
          correlationId: message.correlationId,
          occurredAt: result.issuedAt,
        });
        if (next !== 'EMITIDO') {
          await this.queries.recordTransition(tx, {
            dteId: row.id,
            from: 'EMITIDO',
            to: next,
            source: 'SISTEMA',
            reason: `Emitido dentro de la vigencia (carga ${row.loadDate}).`,
            correlationId: message.correlationId,
            occurredAt: new Date(result.issuedAt.getTime() + 1),
          });
        }
        await this.events.publish(
          {
            eventType: DomainEvents.DteIssued,
            entityType: 'movement',
            entityId: row.movementId,
            organizationId: row.issuerOrganizationId,
            correlationId: message.correlationId,
            payload: {
              dteId: row.id,
              number: result.number,
              status: next,
              issueMode: row.issueMode,
            },
          },
          tx,
        );
        return saved;
      });

      if (!issued) {
        // Se anulo en ApiTrace mientras SIGSA emitia: el numero existe alla y
        // hay que darlo de baja para no dejar un DT-e huerfano.
        this.logger.warn(`DT-e ${row.id} anulado durante la emision; se anula ${result.number}.`);
        await this.gateway
          .voidDte({
            number: result.number,
            externalId: result.externalId,
            reason: 'Solicitud cancelada en ApiTrace antes de recibir el numero.',
            feePaid: false,
          })
          .catch((error: unknown) =>
            this.logger.error(`No se pudo anular el huerfano ${result.number}: ${String(error)}`),
          );
      }
    } catch (error) {
      await this.handleFailure(row, 'DTE_EMITIR', error, started, message.correlationId);
    }
  }

  // -------------------------------------------------------------------------
  // Anulacion, cierre y sin arribo
  // -------------------------------------------------------------------------

  async onVoided(message: OutboxMessage): Promise<void> {
    const row = await this.rowOf(message);
    if (!row?.number || !this.needsRemoteSync(row, 'void')) return;
    const started = Date.now();
    try {
      await this.gateway.voidDte({
        number: row.number,
        externalId: row.externalId,
        reason: row.voidReason ?? 'Anulado en ApiTrace',
        feePaid: row.feePaid,
      });
      await this.markSynced(row, 'DTE_ANULAR', started, message.correlationId);
    } catch (error) {
      await this.handleFailure(row, 'DTE_ANULAR', error, started, message.correlationId);
    }
  }

  async onClosed(message: OutboxMessage): Promise<void> {
    const row = await this.rowOf(message);
    if (!row?.number || !this.needsRemoteSync(row, 'close')) return;
    const started = Date.now();
    try {
      await this.gateway.closeDte({
        number: row.number,
        verificationCode: row.verificationCode,
        arrivalAt: row.arrivalAt ?? row.closedAt ?? new Date(),
        confirmedQuantity: row.confirmedQuantity,
      });
      await this.markSynced(row, 'SITA_CERRAR', started, message.correlationId);
    } catch (error) {
      await this.handleFailure(row, 'SITA_CERRAR', error, started, message.correlationId);
    }
  }

  async onNoArrival(message: OutboxMessage): Promise<void> {
    const row = await this.rowOf(message);
    if (!row?.number || !this.needsRemoteSync(row, 'close')) return;
    const started = Date.now();
    try {
      await this.gateway.reportNoArrival({
        number: row.number,
        reason: 'Declarado sin arribo en ApiTrace',
      });
      await this.markSynced(row, 'SITA_SIN_ARRIBO', started, message.correlationId);
    } catch (error) {
      await this.handleFailure(row, 'SITA_SIN_ARRIBO', error, started, message.correlationId);
    }
  }

  // -------------------------------------------------------------------------
  // Internos
  // -------------------------------------------------------------------------

  private async rowOf(message: OutboxMessage): Promise<DteRow | null> {
    const payload = (message.payload ?? {}) as { dteId?: string };
    if (!payload.dteId) return null;
    return this.queries.findById(payload.dteId);
  }

  /** Un DT-e solo se sincroniza por el canal que lo emitio. */
  private sameChannel(row: DteRow): boolean {
    return (
      (row.issueMode === 'SIMULADO' && this.gateway.mode === 'simulado') ||
      (row.issueMode === 'SIGSA' && this.gateway.mode === 'sigsa')
    );
  }

  private needsRemoteSync(row: DteRow, capability: 'void' | 'close'): boolean {
    // Los DT-e manuales se gestionan en SIGSA/SITA por la persona: aca solo se registran.
    if (row.issueMode === 'MANUAL') return false;
    if (!this.sameChannel(row)) {
      this.logger.warn(
        `DT-e ${row.id} emitido por ${row.issueMode}; el modo actual es ${this.gateway.mode}. No se sincroniza.`,
      );
      return false;
    }
    return this.gateway.capabilities[capability];
  }

  private async markSynced(
    row: DteRow,
    operation: string,
    started: number,
    correlationId: string | null,
  ): Promise<void> {
    await this.integrations.record({
      system: 'SENASA_SIGSA',
      operation,
      status: 'SUCCESS',
      requestId: row.id,
      externalId: row.externalId,
      latencyMs: Date.now() - started,
      correlationId,
    });
    await this.db
      .update(dte)
      .set({
        syncStatus: 'SYNCHRONIZED',
        lastSyncAt: new Date(),
        externalStatus: row.status,
        errorCode: null,
        errorMessage: null,
      })
      .where(eq(dte.id, row.id));
  }

  private async markSyncError(row: DteRow, code: string, message: string): Promise<void> {
    await this.db
      .update(dte)
      .set({ syncStatus: 'ERROR', errorCode: code, errorMessage: message.slice(0, 600) })
      .where(eq(dte.id, row.id));
  }

  /**
   * Rechazo de negocio: se registra y, si era una emision, el DT-e queda
   * RECHAZADO. Falla tecnica: se registra y se relanza para que el outbox
   * reintente.
   */
  private async handleFailure(
    row: DteRow,
    operation: string,
    error: unknown,
    started: number,
    correlationId: string | null,
  ): Promise<void> {
    const business = error instanceof SenasaBusinessError;
    const code =
      error instanceof Error && 'code' in error
        ? String((error as { code: unknown }).code)
        : 'ERROR';
    const text = error instanceof Error ? error.message : String(error);

    await this.integrations.record({
      system: 'SENASA_SIGSA',
      operation,
      status: 'ERROR',
      requestId: row.id,
      externalId: row.externalId,
      latencyMs: Date.now() - started,
      errorCode: code,
      errorMessage: text,
      correlationId,
    });

    if (business && operation === 'DTE_EMITIR') {
      await this.db.transaction(async (tx) => {
        const [saved] = await tx
          .update(dte)
          .set({
            status: 'RECHAZADO',
            syncStatus: 'SYNCHRONIZED',
            lastSyncAt: new Date(),
            errorCode: code,
            errorMessage: text.slice(0, 600),
            updatedAt: new Date(),
          })
          .where(and(eq(dte.id, row.id), eq(dte.status, 'SOLICITADO')))
          .returning();
        if (!saved) return;
        await this.queries.recordTransition(tx, {
          dteId: row.id,
          from: 'SOLICITADO',
          to: 'RECHAZADO',
          source: 'SENASA',
          reason: text,
          correlationId,
        });
        await this.events.publish(
          {
            eventType: DomainEvents.DteRejected,
            entityType: 'movement',
            entityId: row.movementId,
            organizationId: row.issuerOrganizationId,
            correlationId,
            payload: { dteId: row.id, code, reason: text },
          },
          tx,
        );
      });
      return;
    }

    await this.markSyncError(row, code, text);
    if (!business) throw error;
  }
}
