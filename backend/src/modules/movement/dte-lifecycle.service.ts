import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, lt, lte } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { dte, dteStatusHistory } from '../../database/schema';
import { DomainEvents, EventsService } from '../../common/services/events.service';
import {
  addDaysIso,
  DteStatuses,
  LAPSE_GRACE_DAYS,
  toArgentinaDateString,
} from './dte.rules';

@Injectable()
export class DteLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DteLifecycleService.name);
  private timer?: NodeJS.Timeout;
  private isSweeping = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService,
    private readonly events: EventsService,
  ) {}

  onModuleInit(): void {
    const enabled = this.config.get<boolean>('dteLifecycle.enabled') ?? true;
    if (!enabled) {
      this.logger.warn('DteLifecycleService deshabilitado por configuracion.');
      return;
    }

    const interval = this.config.get<number>('dteLifecycle.intervalMs') ?? 60000;
    this.timer = setInterval(() => {
      void this.sweep();
    }, interval);
    this.timer.unref();

    this.logger.log(`DteLifecycleService activo (intervalo ${interval}ms).`);
    void this.sweep();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<{ becameValid: number; expired: number; lapsed: number }> {
    if (this.isSweeping) return { becameValid: 0, expired: 0, lapsed: 0 };
    this.isSweeping = true;

    let becameValid = 0;
    let expired = 0;
    let lapsed = 0;

    try {
      const now = new Date();
      const todayAr = toArgentinaDateString(now);
      const graceDateAr = addDaysIso(todayAr, -LAPSE_GRACE_DAYS);

      // 1. EMITIDO -> VIGENTE (cuando la fecha de carga ha llegado: loadDate <= todayAr)
      const toValid = await this.db
        .select()
        .from(dte)
        .where(
          and(
            eq(dte.status, DteStatuses.EMITIDO),
            lte(dte.loadDate, todayAr),
          ),
        )
        .limit(100);

      for (const item of toValid) {
        await this.db
          .update(dte)
          .set({ status: DteStatuses.VIGENTE, updatedAt: now })
          .where(eq(dte.id, item.id));

        await this.db.insert(dteStatusHistory).values({
          dteId: item.id,
          fromStatus: DteStatuses.EMITIDO,
          toStatus: DteStatuses.VIGENTE,
          source: 'SISTEMA_CRON',
          reason: 'Inicio de vigencia de transito por fecha de carga cumplida.',
          occurredAt: now,
        });

        await this.events.publish({
          eventType: DomainEvents.DteBecameValid,
          entityType: 'dte',
          entityId: item.id,
          payload: { number: item.number },
          recordInTimeline: false,
        });
        becameValid++;
      }

      // 2. VIGENTE -> VENCIDO (cuando expiryDate < todayAr)
      const toExpired = await this.db
        .select()
        .from(dte)
        .where(
          and(
            eq(dte.status, DteStatuses.VIGENTE),
            lt(dte.expiryDate, todayAr),
          ),
        )
        .limit(100);

      for (const item of toExpired) {
        await this.db
          .update(dte)
          .set({ status: DteStatuses.VENCIDO, updatedAt: now })
          .where(eq(dte.id, item.id));

        await this.db.insert(dteStatusHistory).values({
          dteId: item.id,
          fromStatus: DteStatuses.VIGENTE,
          toStatus: DteStatuses.VENCIDO,
          source: 'SISTEMA_CRON',
          reason: 'Plazo maximo de vigencia superado sin registro de arribo.',
          occurredAt: now,
        });

        await this.events.publish({
          eventType: DomainEvents.DteExpired,
          entityType: 'dte',
          entityId: item.id,
          payload: { number: item.number },
          recordInTimeline: false,
        });
        expired++;
      }

      // 3. VENCIDO -> CADUCADO (cuando expiryDate <= graceDateAr)
      const toLapsed = await this.db
        .select()
        .from(dte)
        .where(
          and(
            eq(dte.status, DteStatuses.VENCIDO),
            lte(dte.expiryDate, graceDateAr),
          ),
        )
        .limit(100);

      for (const item of toLapsed) {
        await this.db
          .update(dte)
          .set({ status: DteStatuses.CADUCADO, updatedAt: now })
          .where(eq(dte.id, item.id));

        await this.db.insert(dteStatusHistory).values({
          dteId: item.id,
          fromStatus: DteStatuses.VENCIDO,
          toStatus: DteStatuses.CADUCADO,
          source: 'SISTEMA_CRON',
          reason: `Superados los ${LAPSE_GRACE_DAYS} dias de gracia post-vencimiento. DT-e caducado definitivamente.`,
          occurredAt: now,
        });

        await this.events.publish({
          eventType: DomainEvents.DteLapsed,
          entityType: 'dte',
          entityId: item.id,
          payload: { number: item.number },
          recordInTimeline: false,
        });
        lapsed++;
      }
    } catch (err) {
      this.logger.error('Error durante el barrido temporal de DT-e:', err);
    } finally {
      this.isSweeping = false;
    }

    return { becameValid, expired, lapsed };
  }
}
