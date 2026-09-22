import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, isNotNull, lt, lte, or, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { dte, dteStatusHistory } from '../../database/schema';
import {
  DomainEvents,
  EventsService,
  type DomainEventType,
} from '../../common/services/events.service';
import type { DbExecutor } from '../../common/services/types';
import type { AppConfig } from '../../config/configuration';
import { DteQueries, type DteRow } from './dte.queries';
import {
  DTE_RULES,
  addDays,
  effectiveStatus,
  toArDate,
  transitWindow,
  type DteStatus,
} from './dte.rules';

interface TimeStep {
  to: DteStatus;
  at: Date;
  event: DomainEventType;
  reason: string;
}

const SEQUENCE: DteStatus[] = ['EMITIDO', 'VIGENTE', 'VENCIDO', 'CADUCADO'];

/**
 * Hace avanzar el DT-e con el reloj: EMITIDO -> VIGENTE -> VENCIDO -> CADUCADO.
 *
 * La regla vive en dte.rules.ts; este servicio solo la persiste. Corre de tres
 * maneras, todas con el mismo codigo:
 *   - barrido periodico (DTE_LIFECYCLE_INTERVAL_MS);
 *   - al leer (listado, resumen, detalle), para que los filtros por estado
 *     nunca devuelvan un DT-e "vigente" que ya vencio;
 *   - antes de una accion de usuario, para que el historial muestre cada paso.
 *
 * Cada paso se registra con el instante en que efectivamente ocurrio (00:00 de
 * la carga, 23:59 del vencimiento), no con la hora del barrido. Las
 * actualizaciones son condicionales al estado leido: dos barridos simultaneos no
 * duplican transiciones.
 */
@Injectable()
export class DteLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DteLifecycleService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService,
    private readonly queries: DteQueries,
    private readonly events: EventsService,
  ) {}

  onModuleInit(): void {
    const settings = this.config.get<AppConfig['dteLifecycle']>('dteLifecycle');
    if (!settings?.enabled) {
      this.logger.warn('Barrido de vigencia de DT-e deshabilitado por configuracion.');
      return;
    }
    this.timer = setInterval(() => {
      void this.sweep();
    }, settings.intervalMs);
    this.timer.unref();
    this.logger.log(`Barrido de vigencia de DT-e activo (intervalo ${settings.intervalMs}ms).`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Barrido completo. Nunca lanza: un error se registra y se reintenta en el proximo ciclo. */
  async sweep(now: Date = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const changed = await this.refresh({}, now);
      if (changed > 0) this.logger.log(`Vigencia de DT-e: ${changed} documento(s) actualizados.`);
      return changed;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Fallo el barrido de vigencia de DT-e (se reintentara): ${reason}`);
      return 0;
    } finally {
      this.running = false;
    }
  }

  /**
   * Persiste las transiciones vencidas de los DT-e del alcance indicado.
   * Devuelve cuantos DT-e cambiaron de estado.
   */
  async refresh(
    scope: { organizationId?: string | null; dteId?: string; holderProducerId?: string },
    now: Date = new Date(),
  ): Promise<number> {
    const today = toArDate(now);
    const conditions: SQL[] = [
      inArray(dte.status, ['EMITIDO', 'VIGENTE', 'VENCIDO']),
      isNotNull(dte.loadDate),
      isNotNull(dte.expiryDate),
    ];

    // Solo los candidatos con una frontera ya cumplida, para no recorrer todo.
    const due = or(
      and(eq(dte.status, 'EMITIDO'), lte(dte.loadDate, today)),
      and(eq(dte.status, 'VIGENTE'), lt(dte.expiryDate, today)),
      and(eq(dte.status, 'VENCIDO'), lt(dte.expiryDate, addDays(today, -DTE_RULES.graceDays))),
    );
    if (due) conditions.push(due);

    if (scope.dteId) conditions.push(eq(dte.id, scope.dteId));
    if (scope.holderProducerId) conditions.push(eq(dte.holderProducerId, scope.holderProducerId));
    if (scope.organizationId) {
      const involved = or(
        eq(dte.issuerOrganizationId, scope.organizationId),
        eq(dte.destinationOrganizationId, scope.organizationId),
      );
      if (involved) conditions.push(involved);
    }

    const candidates = await this.db
      .select()
      .from(dte)
      .where(and(...conditions))
      .limit(500);

    let changed = 0;
    for (const row of candidates) {
      const updated = await this.advance(row, now);
      if (updated.status !== row.status) changed += 1;
    }
    return changed;
  }

  /**
   * Avanza un DT-e hasta su estado en `at`, un paso por vez. Si se pasa un
   * ejecutor, corre dentro de esa transaccion (la de la accion del usuario).
   */
  async advance(row: DteRow, at: Date, executor?: DbExecutor): Promise<DteRow> {
    if (this.stepsFor(row, at).length === 0) return row;

    const run = async (tx: DbExecutor): Promise<DteRow> => {
      // Los pasos del reloj van despues del ultimo cambio registrado: un DT-e
      // cargado o emitido tarde no puede mostrar "vigente" antes de su alta.
      const [last] = await tx
        .select({ at: sql<Date | null>`max(${dteStatusHistory.occurredAt})` })
        .from(dteStatusHistory)
        .where(eq(dteStatusHistory.dteId, row.id));
      const lastAt = last?.at ? new Date(last.at) : null;
      const steps = this.stepsFor(row, at, lastAt);

      let current = row;
      for (const step of steps) {
        const [updated] = await tx
          .update(dte)
          .set({ status: step.to, updatedAt: new Date() })
          .where(and(eq(dte.id, row.id), eq(dte.status, current.status)))
          .returning();
        // Otro proceso ya lo movio: su transicion es la que vale.
        if (!updated) return current;

        await this.queries.recordTransition(tx, {
          dteId: row.id,
          from: current.status,
          to: step.to,
          source: 'SISTEMA',
          reason: step.reason,
          occurredAt: step.at,
        });
        await this.events.publish(
          {
            eventType: step.event,
            entityType: 'movement',
            entityId: row.movementId,
            occurredAt: step.at,
            organizationId: row.issuerOrganizationId,
            // El historial de la entidad es para las acciones de las personas;
            // los pasos del reloj quedan en el historial propio del DT-e.
            recordInTimeline: false,
            payload: {
              dteId: row.id,
              number: row.number,
              from: current.status,
              to: step.to,
              holderProducerId: row.holderProducerId,
            },
          },
          tx,
        );
        current = updated;
      }
      return current;
    };

    return executor ? run(executor) : this.db.transaction((tx) => run(tx));
  }

  /**
   * Pasos pendientes entre el estado guardado y el estado en `at`. `after` es
   * el ultimo cambio registrado: ningun paso puede quedar antes que el.
   */
  stepsFor(row: DteRow, at: Date, after: Date | null = null): TimeStep[] {
    const window = transitWindow(row);
    if (!window) return [];
    const target = effectiveStatus(row.status, row, at);
    const from = SEQUENCE.indexOf(row.status as DteStatus);
    const to = SEQUENCE.indexOf(target);
    if (from < 0 || to <= from) return [];

    const boundary: Record<string, Date> = {
      VIGENTE: window.validFrom,
      VENCIDO: new Date(window.validTo.getTime() + 1),
      CADUCADO: new Date(window.lapsesAt.getTime() + 1),
    };
    const describe: Record<string, { event: DomainEventType; reason: string }> = {
      VIGENTE: {
        event: DomainEvents.DteBecameValid,
        reason: `Fecha de carga ${row.loadDate}: el DT-e habilita el transito.`,
      },
      VENCIDO: {
        event: DomainEvents.DteExpired,
        reason: `Vencio el ${row.expiryDate} a las 23:59 sin cierre de la sala.`,
      },
      CADUCADO: {
        event: DomainEvents.DteLapsed,
        reason: `Sin cierre al ${window.lastClosingDate}: caduco. SIGSA bloquea al titular.`,
      },
    };

    // El historial no puede mostrar un paso anterior al alta del documento ni
    // al ultimo cambio registrado (un DT-e cargado despues de su fecha de carga).
    let floor = Math.max(row.createdAt.getTime(), after?.getTime() ?? 0);
    const steps: TimeStep[] = [];
    for (let index = from + 1; index <= to; index += 1) {
      const status = SEQUENCE[index];
      const instant = Math.max(boundary[status].getTime(), floor + 1);
      floor = instant;
      steps.push({ to: status, at: new Date(instant), ...describe[status] });
    }
    return steps;
  }
}
