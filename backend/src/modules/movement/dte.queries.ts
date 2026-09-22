import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { document, dte, dteStatusHistory } from '../../database/schema';
import type { DbExecutor } from '../../common/services/types';
import type { DteStatus } from './dte.rules';

export type DteRow = typeof dte.$inferSelect;

export interface TransitionRecord {
  dteId: string;
  from: DteStatus | null;
  to: DteStatus;
  source: 'USUARIO' | 'SISTEMA' | 'SENASA';
  reason?: string | null;
  actorUserId?: string | null;
  correlationId?: string | null;
  occurredAt?: Date;
}

/**
 * Consultas del DT-e compartidas por MovementService, DteService y el barrido
 * de vigencia. Depende solo de la base: asi MovementService puede consultar el
 * DT-e vigente de un movimiento sin depender de DteService (que a su vez
 * depende de MovementService).
 */
@Injectable()
export class DteQueries {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * DT-e "en juego" de un movimiento: el que no esta dado de baja. Si todos lo
   * estan, el ultimo, para que la pantalla muestre que paso con el documento.
   */
  async currentForMovement(
    movementId: string,
    executor: DbExecutor = this.db,
  ): Promise<DteRow | null> {
    const rows = await executor
      .select()
      .from(dte)
      .where(eq(dte.movementId, movementId))
      .orderBy(
        sql`CASE WHEN ${dte.status} IN ('ANULADO', 'ELIMINADO', 'RECHAZADO') THEN 1 ELSE 0 END`,
        desc(dte.createdAt),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  /** Todos los DT-e del movimiento, del mas reciente al mas antiguo. */
  async listForMovement(movementId: string, executor: DbExecutor = this.db): Promise<DteRow[]> {
    return executor
      .select()
      .from(dte)
      .where(eq(dte.movementId, movementId))
      .orderBy(desc(dte.createdAt));
  }

  async findById(id: string, executor: DbExecutor = this.db): Promise<DteRow | null> {
    const rows = await executor.select().from(dte).where(eq(dte.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /** Deja constancia de un cambio de estado. Se llama dentro de la transaccion del cambio. */
  async recordTransition(executor: DbExecutor, record: TransitionRecord): Promise<void> {
    await executor.insert(dteStatusHistory).values({
      dteId: record.dteId,
      fromStatus: record.from,
      toStatus: record.to,
      source: record.source,
      reason: record.reason?.slice(0, 600) ?? null,
      actorUserId: record.actorUserId ?? null,
      correlationId: record.correlationId ?? null,
      occurredAt: record.occurredAt ?? new Date(),
    });
  }

  async history(dteId: string) {
    return this.db
      .select()
      .from(dteStatusHistory)
      .where(eq(dteStatusHistory.dteId, dteId))
      .orderBy(dteStatusHistory.occurredAt, dteStatusHistory.id);
  }

  /**
   * Refleja el numero oficial en la fila de `document` del DT-e. Se identifica
   * por metadata.dteId y no por movimiento: un movimiento puede tener varios.
   */
  async updateDocumentNumber(executor: DbExecutor, row: DteRow): Promise<void> {
    await executor
      .update(document)
      .set({ number: row.number, issuedAt: row.issuedAt, externalId: row.externalId })
      .where(sql`${document.metadata} ->> 'dteId' = ${row.id}`);
  }
}
