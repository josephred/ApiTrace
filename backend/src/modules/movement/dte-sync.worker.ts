import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DomainEvents } from '../../common/services/events.service';
import { OutboxDispatcher, type OutboxMessage } from '../../common/services/outbox-dispatcher.service';

@Injectable()
export class DteSyncWorker implements OnModuleInit {
  private readonly logger = new Logger(DteSyncWorker.name);

  constructor(private readonly outbox: OutboxDispatcher) {}

  onModuleInit(): void {
    this.outbox.subscribe(DomainEvents.DteRequested, this.handleDteRequested.bind(this));
    this.outbox.subscribe(DomainEvents.DteClosed, this.handleDteClosed.bind(this));
    this.outbox.subscribe(DomainEvents.DteVoided, this.handleDteVoided.bind(this));
    this.logger.log('DteSyncWorker suscripto a eventos de DT-e en outbox.');
  }

  private async handleDteRequested(msg: OutboxMessage): Promise<void> {
    this.logger.log(`[OUTBOX] Procesando solicitud asincrona de DT-e: ${msg.aggregateId}`);
    // En caso de reintento diferido si SENASA estaba caido
  }

  private async handleDteClosed(msg: OutboxMessage): Promise<void> {
    this.logger.log(`[OUTBOX] Notificacion de DT-e cerrado procesada: ${msg.aggregateId}`);
  }

  private async handleDteVoided(msg: OutboxMessage): Promise<void> {
    this.logger.log(`[OUTBOX] Notificacion de DT-e anulado procesada: ${msg.aggregateId}`);
  }
}
