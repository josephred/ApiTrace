import { desc, eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { dte, dteStatusHistory, movement } from '../../database/schema';
import type { DbExecutor } from '../../common/services/types';

export async function findDteById(db: Database, id: string) {
  const [record] = await db.select().from(dte).where(eq(dte.id, id)).limit(1);
  return record ?? null;
}

export async function findDteByMovementId(db: Database, movementId: string) {
  // Ordenado por creacion descendente para obtener el mas reciente si hubo anulados
  const [record] = await db
    .select()
    .from(dte)
    .where(eq(dte.movementId, movementId))
    .orderBy(desc(dte.createdAt))
    .limit(1);
  return record ?? null;
}

export async function getDteHistory(db: Database, dteId: string) {
  return db
    .select()
    .from(dteStatusHistory)
    .where(eq(dteStatusHistory.dteId, dteId))
    .orderBy(desc(dteStatusHistory.occurredAt));
}

export async function recordStatusHistory(
  executor: DbExecutor,
  params: {
    dteId: string;
    fromStatus: string | null;
    toStatus: string;
    source?: string;
    reason?: string | null;
    actorUserId?: string | null;
    correlationId?: string | null;
  },
) {
  await executor.insert(dteStatusHistory).values({
    dteId: params.dteId,
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    source: params.source ?? 'USUARIO',
    reason: params.reason ?? null,
    actorUserId: params.actorUserId ?? null,
    correlationId: params.correlationId ?? null,
    occurredAt: new Date(),
  });
}
