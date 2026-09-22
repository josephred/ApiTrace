import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { apiary, dte, movement, reception } from '../../database/schema';
import { AccessControlService } from '../../common/services/access-control.service';
import { CodeService } from '../../common/services/code.service';
import { DomainEvents, EventsService } from '../../common/services/events.service';
import { DomainRuleException } from '../../common/exceptions/domain-rule.exception';
import type { DbExecutor } from '../../common/services/types';
import { quantitiesDiffer, toNumber } from '../../common/utils/numbers';
import { EstablishmentService } from '../establishment/establishment.service';
import { MovementRuleService } from './movement-rule.service';
import { DteQueries } from './dte.queries';
import { presentDte } from './dte.presenter';
import { DTE_RULES, effectiveStatus, isVoid, validateConfirmedQuantity } from './dte.rules';
import type { AuthenticatedUser } from '../../common/types';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type {
  CancelMovementDto,
  CreateMovementDto,
  DispatchMovementDto,
  ReceiveMovementDto,
} from './dto/movement.dto';

/** Transiciones validas del movimiento. Todo lo demas es un 409. */
const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['IN_TRANSIT', 'RECEIVED', 'PARTIALLY_RECEIVED', 'REJECTED', 'CANCELLED'],
  IN_TRANSIT: ['RECEIVED', 'PARTIALLY_RECEIVED', 'REJECTED'],
  RECEIVED: [],
  PARTIALLY_RECEIVED: [],
  REJECTED: [],
  CANCELLED: [],
};

@Injectable()
export class MovementService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessControlService,
    private readonly events: EventsService,
    private readonly codes: CodeService,
    private readonly establishments: EstablishmentService,
    private readonly rules: MovementRuleService,
    private readonly dtes: DteQueries,
  ) {}

  /**
   * CU-09. Con `executor` corre dentro de una transaccion ajena: la solicitud
   * de DT-e crea el movimiento y el documento en una sola transaccion.
   */
  async create(
    dto: CreateMovementDto,
    actor: AuthenticatedUser,
    correlationId?: string,
    executor?: DbExecutor,
  ) {
    this.access.assertCanWrite(actor);

    if (dto.originEstablishmentId === dto.destinationEstablishmentId) {
      throw new BadRequestException(
        'El origen y el destino no pueden ser el mismo establecimiento. Para mover stock interno use una transferencia de ubicacion.',
      );
    }

    const [origin, destination] = await Promise.all([
      this.establishments.findRaw(dto.originEstablishmentId),
      this.establishments.findRaw(dto.destinationEstablishmentId),
    ]);

    // Quien crea el movimiento debe pertenecer al origen o al destino.
    this.access.assertMovementAccess(actor, origin.organizationId, destination.organizationId);

    if (origin.status !== 'ACTIVE') {
      throw new BadRequestException(`El establecimiento de origen esta ${origin.status}.`);
    }
    if (destination.status !== 'ACTIVE') {
      throw new BadRequestException(`El establecimiento de destino esta ${destination.status}.`);
    }

    if (dto.originApiaryId) {
      const rows = await this.db
        .select()
        .from(apiary)
        .where(eq(apiary.id, dto.originApiaryId))
        .limit(1);
      if (rows.length === 0) throw new NotFoundException('El apiario de origen no existe.');
      if (rows[0].establishmentId !== dto.originEstablishmentId) {
        throw new BadRequestException(
          'El apiario indicado no pertenece al establecimiento de origen.',
        );
      }
    }

    const scheduledAt = new Date(dto.scheduledAt);
    // La regla se evalua con la fecha del movimiento, no con la fecha de carga.
    const decision = await this.rules.evaluate({
      movementType: dto.movementType,
      materialType: dto.materialType,
      originType: origin.type,
      destinationType: destination.type,
      at: scheduledAt,
    });

    const run = async (tx: DbExecutor) => {
      const code = await this.codes.next('MOV', tx, scheduledAt);
      const [created] = await tx
        .insert(movement)
        .values({
          code,
          movementType: dto.movementType,
          materialType: dto.materialType,
          originEstablishmentId: dto.originEstablishmentId,
          originApiaryId: dto.originApiaryId ?? null,
          destinationEstablishmentId: dto.destinationEstablishmentId,
          carrierId: dto.carrierId ?? null,
          vehicleId: dto.vehicleId ?? null,
          driverName: dto.driverName ?? null,
          driverDocument: dto.driverDocument ?? null,
          scheduledAt,
          quantity: String(dto.quantity),
          unit: dto.unit,
          status: 'DRAFT',
          requiresDocument: decision.requiresDocument,
          requiredDocumentType: decision.requiredDocumentType as never,
          appliedRuleId: decision.ruleId,
          notes: dto.notes ?? null,
          createdById: actor.id,
        })
        .returning();

      await this.events.publish(
        {
          eventType: DomainEvents.MovementCreated,
          entityType: 'movement',
          entityId: created.id,
          actorUserId: actor.id,
          organizationId: origin.organizationId,
          correlationId,
          // El evento ocurre al registrarse: scheduledAt es la fecha planificada
          // del traslado y viaja en el payload, no como instante del evento.
          payload: {
            code: created.code,
            originEstablishmentId: origin.id,
            destinationEstablishmentId: destination.id,
            originApiaryId: created.originApiaryId,
            quantity: created.quantity,
            unit: created.unit,
            requiresDocument: created.requiresDocument,
            appliedRule: decision.ruleName,
          },
        },
        tx,
      );

      return { ...created, appliedRule: decision };
    };

    return executor ? run(executor) : this.db.transaction((tx) => run(tx));
  }

  async list(
    query: PaginationQueryDto,
    actor: AuthenticatedUser,
    filters: { status?: string; establishmentId?: string } = {},
  ) {
    const conditions: SQL[] = [];
    const scope = this.access.organizationScope(actor);

    if (scope) {
      // Un movimiento es visible desde ambos extremos de la cadena.
      const visible = or(
        sql`${movement.originEstablishmentId} IN (SELECT id FROM establishment WHERE organization_id = ${scope})`,
        sql`${movement.destinationEstablishmentId} IN (SELECT id FROM establishment WHERE organization_id = ${scope})`,
      );
      if (visible) conditions.push(visible);
    }
    if (filters.status) conditions.push(eq(movement.status, filters.status as never));
    if (filters.establishmentId) {
      const atEither = or(
        eq(movement.originEstablishmentId, filters.establishmentId),
        eq(movement.destinationEstablishmentId, filters.establishmentId),
      );
      if (atEither) conditions.push(atEither);
    }
    if (query.q) conditions.push(sql`${movement.code} ILIKE ${`%${query.q}%`}`);

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(movement)
        .where(where)
        .orderBy(desc(movement.scheduledAt))
        .limit(query.pageSize)
        .offset(query.offset),
      this.db.select({ count: sql<number>`cast(count(*) as int)` }).from(movement).where(where),
    ]);
    return { rows, total: count };
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const rows = await this.db.select().from(movement).where(eq(movement.id, id)).limit(1);
    if (rows.length === 0) throw new NotFoundException('Movimiento no encontrado.');
    const record = rows[0];

    const parties = await this.establishments.findManyRaw([
      record.originEstablishmentId,
      record.destinationEstablishmentId,
    ]);
    const origin = parties.find((e) => e.id === record.originEstablishmentId);
    const destination = parties.find((e) => e.id === record.destinationEstablishmentId);
    this.access.assertMovementAccess(
      actor,
      origin?.organizationId ?? null,
      destination?.organizationId ?? null,
    );

    // Puede haber varios DT-e (anulado y reemitido): el que importa es el que esta en juego.
    const current = await this.dtes.currentForMovement(id);
    const [received] = await this.db
      .select()
      .from(reception)
      .where(eq(reception.movementId, id))
      .limit(1);

    return {
      ...record,
      origin,
      destination,
      dte: current ? presentDte(current, actor) : null,
      reception: received ?? null,
    };
  }

  /** Uso interno (extraccion, trazabilidad): sin control de acceso. */
  async findRaw(id: string) {
    const rows = await this.db.select().from(movement).where(eq(movement.id, id)).limit(1);
    if (rows.length === 0) throw new NotFoundException(`Movimiento ${id} no encontrado.`);
    return rows[0];
  }

  private assertTransition(from: string, to: string): void {
    if (!TRANSITIONS[from]?.includes(to)) {
      throw new ConflictException(
        `Transicion invalida: un movimiento en ${from} no puede pasar a ${to}.`,
      );
    }
  }

  /** Despacho. Aqui se hace exigible el documento que determino la regla. */
  async dispatch(
    id: string,
    dto: DispatchMovementDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ) {
    this.access.assertCanWrite(actor);
    const record = await this.findOne(id, actor);
    this.assertTransition(record.status, 'DISPATCHED');

    const dispatchedAt = dto.dispatchedAt ? new Date(dto.dispatchedAt) : new Date();

    if (record.requiresDocument) {
      const document = await this.dtes.currentForMovement(id);
      if (!document || isVoid(document.status)) {
        throw new DomainRuleException(
          HttpStatus.CONFLICT,
          'DOCUMENTO_REQUERIDO',
          `Este movimiento requiere ${record.requiredDocumentType ?? 'un documento'} antes de despacharse. Genere el DT-e con POST /movements/${id}/dte.`,
        );
      }
      if (document.movementTypeCode === DTE_RULES.movementTypeCode) {
        // Semaforo de transito (checklist 9): solo un DT-e VIGENTE en el
        // momento de la salida habilita la ruta.
        const status = effectiveStatus(document.status, document, dispatchedAt);
        if (status !== 'VIGENTE') {
          throw new DomainRuleException(
            HttpStatus.CONFLICT,
            'DTE_NO_VIGENTE',
            status === 'EMITIDO'
              ? `El DT-e se habilita el ${document.loadDate} a las 00:00: antes no se puede transitar.`
              : ['BORRADOR', 'SOLICITADO'].includes(status)
                ? 'El DT-e todavia no fue emitido: no ampara el traslado.'
                : `El DT-e esta ${status}: no ampara el traslado. Anulalo (si corresponde) y emiti uno nuevo.`,
            { dteStatus: status, loadDate: document.loadDate, expiryDate: document.expiryDate },
          );
        }
      } else if (!['EMITIDO', 'VIGENTE'].includes(document.status)) {
        throw new DomainRuleException(
          HttpStatus.CONFLICT,
          'DOCUMENTO_NO_EMITIDO',
          `El documento asociado esta en estado ${document.status}; debe estar EMITIDO para despachar.`,
        );
      }
    }

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(movement)
        .set({
          status: 'DISPATCHED',
          dispatchedAt,
          notes: dto.notes ?? record.notes,
          updatedAt: new Date(),
        })
        .where(eq(movement.id, id))
        .returning();

      await this.events.publish(
        {
          eventType: DomainEvents.MovementDispatched,
          entityType: 'movement',
          entityId: id,
          actorUserId: actor.id,
          correlationId,
          occurredAt: dispatchedAt,
          payload: { code: updated.code, dispatchedAt: dispatchedAt.toISOString() },
        },
        tx,
      );
      return updated;
    });
  }

  /** CU-11. */
  async receive(
    id: string,
    dto: ReceiveMovementDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ) {
    this.access.assertCanWrite(actor);
    const record = await this.findOne(id, actor);

    if (record.reception) {
      throw new ConflictException('El movimiento ya fue recibido.');
    }

    // Solo el destino confirma la recepcion.
    if (!this.access.hasGlobalScope(actor)) {
      if (record.destination?.organizationId !== actor.organizationId) {
        throw new ConflictException(
          'Solo la organizacion de destino puede registrar la recepcion de este movimiento.',
        );
      }
    }

    const expected = toNumber(record.quantity);
    const receivedQuantity = dto.receivedQuantity;

    // Con DT-e exigido, la descarga necesita un documento en juego y, si se
    // cuenta en alzas, no puede superar lo declarado (especificacion 5.2).
    if (record.requiresDocument && record.requiredDocumentType === 'DTE') {
      const document = await this.dtes.currentForMovement(id);
      if (!document || isVoid(document.status)) {
        throw new DomainRuleException(
          HttpStatus.CONFLICT,
          'DTE_REQUERIDO',
          'El movimiento no tiene un DT-e en juego: emiti uno nuevo antes de descargar.',
        );
      }
      if ((dto.unit ?? record.unit) === 'ALZA') {
        const violation = validateConfirmedQuantity(document.declaredQuantity, receivedQuantity);
        if (violation) {
          throw new DomainRuleException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            violation.code,
            violation.message,
            {
              dteId: document.id,
              declaredQuantity: document.declaredQuantity,
              confirmedQuantity: receivedQuantity,
              minimumToDeclare: Math.ceil(receivedQuantity),
            },
          );
        }
      }
    }

    const hasDiscrepancy = quantitiesDiffer(expected, receivedQuantity);
    const result =
      dto.result ?? (receivedQuantity <= 0 ? 'REJECTED' : hasDiscrepancy ? 'PARTIAL' : 'ACCEPTED');

    if (hasDiscrepancy && !dto.discrepancyNotes && result !== 'REJECTED') {
      throw new BadRequestException(
        `La cantidad recibida (${receivedQuantity}) difiere de la declarada (${expected}). Indique discrepancyNotes para dejar constancia.`,
      );
    }

    const nextStatus =
      result === 'REJECTED' ? 'REJECTED' : result === 'PARTIAL' ? 'PARTIALLY_RECEIVED' : 'RECEIVED';
    this.assertTransition(record.status, nextStatus);

    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();

    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(reception)
        .values({
          movementId: id,
          establishmentId: record.destinationEstablishmentId,
          receivedByUserId: actor.id,
          receivedAt,
          receivedQuantity: String(receivedQuantity),
          unit: dto.unit ?? record.unit,
          result,
          hasDiscrepancy,
          discrepancyNotes: dto.discrepancyNotes ?? null,
          notes: dto.notes ?? null,
        })
        .returning();

      await tx
        .update(movement)
        .set({ status: nextStatus, receivedAt, updatedAt: new Date() })
        .where(eq(movement.id, id));

      await this.events.publish(
        {
          eventType:
            result === 'REJECTED' ? DomainEvents.MovementRejected : DomainEvents.MovementReceived,
          entityType: 'movement',
          entityId: id,
          actorUserId: actor.id,
          correlationId,
          occurredAt: receivedAt,
          payload: {
            code: record.code,
            receptionId: created.id,
            receivedQuantity,
            expectedQuantity: expected,
            result,
            hasDiscrepancy,
          },
        },
        tx,
      );

      return created;
    });
  }

  async cancel(
    id: string,
    dto: CancelMovementDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ) {
    this.access.assertCanWrite(actor);
    const record = await this.findOne(id, actor);
    this.assertTransition(record.status, 'CANCELLED');

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(movement)
        .set({
          status: 'CANCELLED',
          notes: `${record.notes ?? ''}\n[CANCELADO] ${dto.reason}`.trim().slice(0, 1000),
          updatedAt: new Date(),
        })
        .where(eq(movement.id, id))
        .returning();

      // Un DT-e que todavia no transito se da de baja con el movimiento. Sin
      // dato del arancel, la baja es ELIMINADO; si se abono, anular desde /dte.
      const document = await this.dtes.currentForMovement(id, tx);
      const now = new Date();
      const documentStatus = document ? effectiveStatus(document.status, document, now) : null;
      if (
        document &&
        documentStatus &&
        ['BORRADOR', 'SOLICITADO', 'EMITIDO', 'VIGENTE'].includes(documentStatus)
      ) {
        const reason = `Movimiento cancelado: ${dto.reason}`.slice(0, 600);
        const [voided] = await tx
          .update(dte)
          .set({ status: 'ELIMINADO', voidedAt: now, voidReason: reason, updatedAt: now })
          .where(and(eq(dte.id, document.id), eq(dte.status, document.status)))
          .returning();
        if (voided) {
          await this.dtes.recordTransition(tx, {
            dteId: document.id,
            from: document.status,
            to: 'ELIMINADO',
            source: 'USUARIO',
            reason,
            actorUserId: actor.id,
            correlationId,
          });
          await this.events.publish(
            {
              eventType: DomainEvents.DteVoided,
              entityType: 'movement',
              entityId: id,
              actorUserId: actor.id,
              correlationId,
              payload: {
                dteId: document.id,
                number: document.number,
                status: 'ELIMINADO',
                reason,
                feePaid: false,
              },
            },
            tx,
          );
        }
      }

      await this.events.publish(
        {
          eventType: DomainEvents.MovementCancelled,
          entityType: 'movement',
          entityId: id,
          actorUserId: actor.id,
          correlationId,
          payload: { code: record.code, reason: dto.reason },
        },
        tx,
      );
      return updated;
    });
  }

  /** Movimientos recibidos en un establecimiento y aun disponibles para extraccion. */
  async listReceivedAt(establishmentId: string) {
    return this.db
      .select()
      .from(movement)
      .where(
        and(
          eq(movement.destinationEstablishmentId, establishmentId),
          inArray(movement.status, ['RECEIVED', 'PARTIALLY_RECEIVED']),
        ),
      )
      .orderBy(desc(movement.receivedAt));
  }
}
