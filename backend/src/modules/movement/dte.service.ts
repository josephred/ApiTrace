import {
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ne, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { document, dte, movement, reception } from '../../database/schema';
import { AccessControlService } from '../../common/services/access-control.service';
import { DomainEvents, EventsService } from '../../common/services/events.service';
import { DomainRuleException } from '../../common/exceptions/domain-rule.exception';
import type { DbExecutor } from '../../common/services/types';
import type { AuthenticatedUser } from '../../common/types';
import { EstablishmentService } from '../establishment/establishment.service';
import { MovementService } from './movement.service';
import { DteQueries, type DteRow } from './dte.queries';
import { DteLifecycleService } from './dte-lifecycle.service';
import { DteChecksService } from './dte-checks.service';
import { DteQueryService } from './dte-query.service';
import { presentDte } from './dte.presenter';
import { assertIssuer, assertReceiver } from './dte.access';
import {
  apiSemDefaults,
  assertDraftRules,
  draftColumns,
  draftOf,
  normalizeDraft,
  officialSnapshot,
  scheduledAtFor,
  transportOf,
} from './dte.draft';
import {
  DTE_RULES,
  effectiveStatus,
  isVoid,
  normalizeCode,
  toArDate,
  validateConfirmedQuantity,
  type DteStatus,
} from './dte.rules';
import { SENASA_GATEWAY, type SenasaGateway } from './senasa/senasa.gateway';
import type { DraftData, DteContext, MovementRow } from './dte.types';
import type { CloseDteDto, CreateDteDto, UpdateDteStatusDto } from './dto/movement.dto';
import type {
  CloseDteRequestDto,
  CreateDteRequestDto,
  IssueDteDto,
  NoArrivalDteDto,
  RegularizeDteDto,
  UpdateDteDraftDto,
  VoidDteDto,
} from './dto/dte.dto';

const OPEN_FOR_VOID: DteStatus[] = ['BORRADOR', 'SOLICITADO', 'EMITIDO', 'VIGENTE'];
const OPEN_FOR_CLOSE: DteStatus[] = ['VIGENTE', 'VENCIDO'];

/**
 * Gestion del DT-e API-SEM por usuario (CU-10, CU-12; especificacion DT-e 4 a 6).
 *
 * El titular del apiario prepara, emite, anula y reemite sus DT-e; la sala de
 * destino los cierra (o declara que no arribaron). Cada organizacion ve los
 * DT-e que emite y los que recibe, nunca los de terceros.
 *
 * La emision pasa por SENASA_GATEWAY: en modo manual se registra el numero
 * obtenido en SIGSA; en modo simulado y sigsa se pide por API de forma
 * asincrona (outbox -> DteSyncWorker), porque SIGSA puede demorar o no
 * responder y la operacion no debe perderse.
 *
 * Las lecturas viven en DteQueryService y las verificaciones en DteChecksService.
 */
@Injectable()
export class DteService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessControlService,
    private readonly events: EventsService,
    private readonly movements: MovementService,
    private readonly establishments: EstablishmentService,
    private readonly queries: DteQueries,
    private readonly lifecycle: DteLifecycleService,
    private readonly checks: DteChecksService,
    private readonly reads: DteQueryService,
    @Inject(SENASA_GATEWAY) private readonly gateway: SenasaGateway,
  ) {}

  // =========================================================================
  // Alta
  // =========================================================================

  /**
   * Solicitud de DT-e API-SEM (POST /dte). Sin movementId crea tambien el
   * movimiento, en la misma transaccion: o quedan los dos o ninguno.
   */
  async create(dto: CreateDteRequestDto, actor: AuthenticatedUser, correlationId?: string) {
    this.access.assertCanWrite(actor);
    const now = new Date();

    if (dto.number && dto.submit) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'NUMERO_Y_SOLICITUD',
        'Indica el numero de un DT-e ya emitido o pedi la emision a SIGSA, no las dos cosas.',
      );
    }

    let existing: MovementRow | null = null;
    let ctx: DteContext;
    if (dto.movementId) {
      const found = await this.movements.findOne(dto.movementId, actor);
      existing = found;
      ctx = await this.checks.contextForMovement(found);
      assertIssuer(actor, ctx.origin.organizationId);
      this.assertMovementAcceptsDte(found);
      await this.assertNoActiveDte(found.id);
      if (!this.isApiSem(found, ctx)) {
        throw new DomainRuleException(
          HttpStatus.BAD_REQUEST,
          'DTE_NO_APLICA',
          'El DT-e API-SEM ampara el traslado de material melario de un apiario a una sala de extraccion. Para otros documentos use POST /movements/:id/dte.',
        );
      }
      if (!found.originApiaryId) {
        throw new DomainRuleException(
          HttpStatus.BAD_REQUEST,
          'MOVIMIENTO_SIN_APIARIO',
          'El movimiento no indica el apiario de origen, que es el origen oficial del DT-e.',
        );
      }
    } else {
      if (!dto.apiaryId || !dto.destinationEstablishmentId) {
        throw new DomainRuleException(
          HttpStatus.BAD_REQUEST,
          'ORIGEN_DESTINO_REQUERIDOS',
          'Indica el apiario de origen (apiaryId) y la sala de destino (destinationEstablishmentId), o un movimiento existente (movementId).',
        );
      }
      ctx = await this.checks.contextForNew(dto.apiaryId, dto.destinationEstablishmentId);
      assertIssuer(actor, ctx.origin.organizationId);
    }

    const draft = normalizeDraft(dto);
    assertDraftRules(draft);

    const checks = await this.checks.buildChecks(ctx, draft, {
      forSubmission: Boolean(dto.submit),
      now,
    });
    if (dto.submit) {
      this.assertGatewayCanEmit();
      this.checks.assertChecksPass(checks);
    }
    const number = dto.number?.trim() || null;
    if (number) await this.assertNumberAvailable(number);

    const initial: DteStatus = number ? 'EMITIDO' : dto.submit ? 'SOLICITADO' : 'BORRADOR';

    const created = await this.db.transaction(async (tx) => {
      let target = existing;
      if (!target) {
        target = await this.movements.create(
          {
            movementType: 'MATERIAL_MELARIO',
            materialType: 'MATERIAL_MELARIO',
            originEstablishmentId: ctx.origin.id,
            originApiaryId: ctx.apiary?.id,
            destinationEstablishmentId: ctx.destination.id,
            carrierId: dto.carrierId,
            vehicleId: dto.vehicleId,
            driverName: dto.driverName,
            driverDocument: dto.driverDocument,
            // El traslado se programa en la fecha de carga: con esa fecha el
            // motor de reglas decide la exigencia documental.
            scheduledAt: scheduledAtFor(draft.loadDate),
            quantity: draft.estimatedQuantity ?? draft.declaredQuantity ?? 1,
            unit: 'ALZA',
            notes: dto.notes,
          },
          actor,
          correlationId,
          tx,
        );
      }

      const [row] = await tx
        .insert(dte)
        .values({
          movementId: target.id,
          number,
          status: initial,
          issueMode: number ? 'MANUAL' : dto.submit ? this.gatewayIssueMode() : 'MANUAL',
          issuedAt: number ? (dto.issuedAt ? new Date(dto.issuedAt) : now) : null,
          requestedAt: dto.submit ? now : null,
          verificationCode: dto.verificationCode?.trim() || null,
          ...officialSnapshot(ctx),
          ...apiSemDefaults(),
          ...draftColumns(draft),
          requestedById: actor.id,
          originRenspa: await this.establishments.activeRenspaNumber(ctx.origin.id),
          destinationRenspa: await this.establishments.activeRenspaNumber(ctx.destination.id),
          externalSystem: 'SENASA_SIGSA',
          syncStatus: 'PENDING_SYNC',
          payload: {
            movementCode: target.code,
            materialType: target.materialType,
            quantity: target.quantity,
            unit: target.unit,
          } as never,
        })
        .returning();

      await this.insertDocument(tx, row, actor);
      await this.queries.recordTransition(tx, {
        dteId: row.id,
        from: null,
        to: initial,
        source: 'USUARIO',
        reason:
          initial === 'EMITIDO'
            ? `Registro del DT-e ${number} emitido en SIGSA.`
            : initial === 'SOLICITADO'
              ? 'Alta y solicitud de emision a SIGSA.'
              : 'Alta del borrador.',
        actorUserId: actor.id,
        correlationId,
      });
      await this.events.publish(
        {
          eventType: DomainEvents.DteCreated,
          entityType: 'movement',
          entityId: target.id,
          actorUserId: actor.id,
          organizationId: row.issuerOrganizationId,
          correlationId,
          payload: {
            dteId: row.id,
            number: row.number,
            status: row.status,
            syncStatus: row.syncStatus,
            issueMode: row.issueMode,
          },
        },
        tx,
      );
      if (initial === 'SOLICITADO') await this.publishRequested(tx, row, actor, correlationId);
      return row;
    });

    return { ...presentDte(created, actor, now), checks };
  }

  /**
   * Registro del documento de un movimiento existente (POST /movements/:id/dte).
   * Compatibilidad con la version anterior y con la cola offline.
   */
  async createForMovement(
    movementId: string,
    dto: CreateDteDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ) {
    this.access.assertCanWrite(actor);
    const now = new Date();
    const record = await this.movements.findOne(movementId, actor);

    const current = await this.queries.currentForMovement(movementId);
    if (current && !isVoid(current.status)) {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'DTE_ACTIVO_EXISTENTE',
        'El movimiento ya tiene un DT-e asociado.',
      );
    }
    if (['RECEIVED', 'REJECTED', 'CANCELLED'].includes(record.status)) {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'MOVIMIENTO_CERRADO',
        `No se puede emitir un DT-e para un movimiento en estado ${record.status}.`,
      );
    }

    const ctx = await this.checks.contextForMovement(record);
    const apiSem = this.isApiSem(record, ctx);
    const number = dto.number?.trim() || null;
    let draft: DraftData | null = null;

    if (apiSem) {
      assertIssuer(actor, ctx.origin.organizationId);
      const loadDate = dto.loadDate ?? toArDate(record.scheduledAt);
      draft = normalizeDraft({
        estimatedQuantity: dto.estimatedQuantity,
        declaredQuantity:
          dto.declaredQuantity ??
          (record.unit === 'ALZA' ? Math.ceil(Number(record.quantity)) : undefined),
        loadDate,
        expiryDate: dto.expiryDate,
        transport: dto.transport,
      });
      assertDraftRules(draft);
      if (number) await this.assertNumberAvailable(number);
    } else {
      this.access.assertMovementAccess(
        actor,
        ctx.origin.organizationId,
        ctx.destination.organizationId,
      );
    }

    const issuedAt = dto.issuedAt ? new Date(dto.issuedAt) : now;
    const status: DteStatus = number ? 'EMITIDO' : 'BORRADOR';

    const [originRenspa, destinationRenspa] = await Promise.all([
      dto.originRenspa
        ? Promise.resolve(dto.originRenspa)
        : this.establishments.activeRenspaNumber(record.originEstablishmentId),
      dto.destinationRenspa
        ? Promise.resolve(dto.destinationRenspa)
        : this.establishments.activeRenspaNumber(record.destinationEstablishmentId),
    ]);

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(dte)
        .values({
          movementId,
          number,
          status,
          issueMode: 'MANUAL',
          issuedAt: number ? issuedAt : null,
          verificationCode: dto.verificationCode?.trim() || null,
          originRenspa,
          destinationRenspa,
          ...officialSnapshot(ctx),
          ...(apiSem && draft ? { ...apiSemDefaults(), ...draftColumns(draft) } : {}),
          requestedById: actor.id,
          externalSystem: 'SENASA_SIGSA',
          externalId: dto.fromExternalSystem ? number : null,
          // Solo se marca sincronizado si el numero vino del organismo.
          syncStatus: dto.fromExternalSystem ? 'SYNCHRONIZED' : 'PENDING_SYNC',
          lastSyncAt: dto.fromExternalSystem ? now : null,
          payload: {
            movementCode: record.code,
            materialType: record.materialType,
            quantity: record.quantity,
            unit: record.unit,
          } as never,
        })
        .returning();

      await this.insertDocument(tx, row, actor);
      await this.queries.recordTransition(tx, {
        dteId: row.id,
        from: null,
        to: status,
        source: 'USUARIO',
        reason: number ? `Registro del documento ${number}.` : 'Alta del borrador.',
        actorUserId: actor.id,
        correlationId,
      });
      await this.events.publish(
        {
          eventType: DomainEvents.DteCreated,
          entityType: 'movement',
          entityId: movementId,
          actorUserId: actor.id,
          correlationId,
          payload: {
            dteId: row.id,
            number: row.number,
            status: row.status,
            syncStatus: row.syncStatus,
            issueMode: row.issueMode,
          },
        },
        tx,
      );
      return row;
    });

    return presentDte(created, actor, now);
  }

  // =========================================================================
  // Borrador
  // =========================================================================

  async updateDraft(id: string, dto: UpdateDteDraftDto, actor: AuthenticatedUser) {
    this.access.assertCanWrite(actor);
    const row = await this.reads.findVisible(id, actor);
    assertIssuer(actor, row.issuerOrganizationId);
    if (row.status !== 'BORRADOR') {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'DTE_NO_EDITABLE',
        'Solo un borrador se puede editar. Para corregir un DT-e emitido, anulalo y emiti uno nuevo.',
      );
    }
    if (row.movementTypeCode !== DTE_RULES.movementTypeCode) {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'DTE_NO_EDITABLE',
        'Este documento no es un DT-e API-SEM y no se edita por esta via.',
      );
    }

    const loadDate = dto.loadDate ?? row.loadDate ?? toArDate(new Date());
    const draft = normalizeDraft({
      estimatedQuantity: dto.estimatedQuantity ?? row.estimatedQuantity ?? undefined,
      declaredQuantity: dto.declaredQuantity ?? row.declaredQuantity ?? undefined,
      loadDate,
      expiryDate: dto.expiryDate ?? (dto.loadDate ? undefined : (row.expiryDate ?? undefined)),
      transport: dto.transport ?? transportOf(row),
    });
    assertDraftRules(draft);

    const updated = await this.db.transaction(async (tx) => {
      const [saved] = await tx
        .update(dte)
        .set({ ...draftColumns(draft), updatedAt: new Date() })
        .where(and(eq(dte.id, id), eq(dte.status, 'BORRADOR')))
        .returning();
      if (!saved) this.concurrentChange();

      // El movimiento en borrador acompana al DT-e: misma fecha y misma cantidad.
      const [target] = await tx.select().from(movement).where(eq(movement.id, row.movementId));
      if (target && target.status === 'DRAFT' && target.unit === 'ALZA') {
        await tx
          .update(movement)
          .set({
            scheduledAt: new Date(scheduledAtFor(draft.loadDate)),
            quantity: String(draft.estimatedQuantity ?? draft.declaredQuantity ?? target.quantity),
            updatedAt: new Date(),
          })
          .where(eq(movement.id, target.id));
      }
      return saved;
    });

    return presentDte(updated, actor);
  }

  // =========================================================================
  // Emision
  // =========================================================================

  /**
   * Emite un borrador. Con `number` registra un DT-e obtenido en SIGSA (modo
   * manual, siempre disponible como contingencia). Sin `number` lo pide por API:
   * queda SOLICITADO y DteSyncWorker completa numero y codigo de cierre.
   */
  async issue(id: string, dto: IssueDteDto, actor: AuthenticatedUser, correlationId?: string) {
    this.access.assertCanWrite(actor);
    const now = new Date();
    const row = await this.reads.findVisible(id, actor);
    assertIssuer(actor, row.issuerOrganizationId);

    if (row.status !== 'BORRADOR') {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'DTE_NO_EMITIBLE',
        `Solo un borrador puede emitirse; este DT-e esta ${effectiveStatus(row.status, row, now)}.`,
      );
    }

    const target = await this.movements.findRaw(row.movementId);
    const ctx = await this.checks.contextForMovement(target);
    const number = dto.number?.trim() || null;

    if (number) {
      if (row.movementTypeCode === DTE_RULES.movementTypeCode) {
        await this.assertNumberAvailable(number, row.id);
      }
      const updated = await this.db.transaction(async (tx) => {
        const [saved] = await tx
          .update(dte)
          .set({
            status: 'EMITIDO',
            number,
            verificationCode: dto.verificationCode?.trim() || row.verificationCode,
            issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : now,
            issueMode: 'MANUAL',
            ...officialSnapshot(ctx),
            syncStatus: 'PENDING_SYNC',
            errorCode: null,
            errorMessage: null,
            updatedAt: now,
          })
          .where(and(eq(dte.id, id), eq(dte.status, 'BORRADOR')))
          .returning();
        if (!saved) this.concurrentChange();

        await this.queries.updateDocumentNumber(tx, saved);
        await this.queries.recordTransition(tx, {
          dteId: id,
          from: 'BORRADOR',
          to: 'EMITIDO',
          source: 'USUARIO',
          reason: `Registro del numero ${number} emitido en SIGSA.`,
          actorUserId: actor.id,
          correlationId,
        });
        await this.events.publish(
          {
            eventType: DomainEvents.DteIssued,
            entityType: 'movement',
            entityId: row.movementId,
            actorUserId: actor.id,
            organizationId: row.issuerOrganizationId,
            correlationId,
            payload: { dteId: id, number, status: 'EMITIDO', issueMode: 'MANUAL' },
          },
          tx,
        );
        return saved;
      });
      return presentDte(updated, actor, now);
    }

    // Emision por API.
    this.assertGatewayCanEmit();
    if (row.movementTypeCode !== DTE_RULES.movementTypeCode || !row.loadDate || !row.expiryDate) {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'DTE_INCOMPLETO',
        'El borrador no tiene los datos del tramite API-SEM (fechas y alzas). Completalos antes de emitir.',
      );
    }
    const checks = await this.checks.buildChecks(ctx, draftOf(row), { forSubmission: true, now });
    this.checks.assertChecksPass(checks);

    const updated = await this.db.transaction(async (tx) => {
      const [saved] = await tx
        .update(dte)
        .set({
          status: 'SOLICITADO',
          issueMode: this.gatewayIssueMode(),
          requestedAt: now,
          ...officialSnapshot(ctx),
          syncStatus: 'PENDING_SYNC',
          errorCode: null,
          errorMessage: null,
          updatedAt: now,
        })
        .where(and(eq(dte.id, id), eq(dte.status, 'BORRADOR')))
        .returning();
      if (!saved) this.concurrentChange();

      await this.queries.recordTransition(tx, {
        dteId: id,
        from: 'BORRADOR',
        to: 'SOLICITADO',
        source: 'USUARIO',
        reason: `Solicitud de emision enviada (${this.gateway.mode}).`,
        actorUserId: actor.id,
        correlationId,
      });
      await this.publishRequested(tx, saved, actor, correlationId);
      return saved;
    });

    return { ...presentDte(updated, actor, now), checks };
  }

  // =========================================================================
  // Anulacion
  // =========================================================================

  /**
   * Baja del DT-e antes del cierre (seccion 5.1): ANULADO si el arancel se
   * abono, ELIMINADO si no. Tambien es el primer paso ante un exceso de carga
   * (seccion 5.2): anular y emitir uno nuevo para el mismo movimiento.
   */
  async void(id: string, dto: VoidDteDto, actor: AuthenticatedUser, correlationId?: string) {
    this.access.assertCanWrite(actor);
    const now = new Date();
    let row = await this.reads.findVisible(id, actor);
    assertIssuer(actor, row.issuerOrganizationId);

    const current = effectiveStatus(row.status, row, now);
    if (!OPEN_FOR_VOID.includes(current)) {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'DTE_NO_ANULABLE',
        current === 'VENCIDO'
          ? 'Un DT-e vencido no se anula: la sala debe cerrarlo o declarar que la carga no arribo antes de que caduque.'
          : `Un DT-e ${current} no admite anulacion.`,
      );
    }
    const next: DteStatus =
      ['EMITIDO', 'VIGENTE'].includes(current) && dto.feePaid ? 'ANULADO' : 'ELIMINADO';

    const updated = await this.db.transaction(async (tx) => {
      row = await this.lifecycle.advance(row, now, tx);
      const [saved] = await tx
        .update(dte)
        .set({
          status: next,
          voidedAt: now,
          voidReason: dto.reason.trim(),
          feePaid: Boolean(dto.feePaid),
          updatedAt: now,
        })
        .where(and(eq(dte.id, id), eq(dte.status, row.status)))
        .returning();
      if (!saved) this.concurrentChange();

      await this.queries.recordTransition(tx, {
        dteId: id,
        from: row.status,
        to: next,
        source: 'USUARIO',
        reason: dto.reason.trim(),
        actorUserId: actor.id,
        correlationId,
      });
      await this.events.publish(
        {
          eventType: DomainEvents.DteVoided,
          entityType: 'movement',
          entityId: row.movementId,
          actorUserId: actor.id,
          organizationId: row.issuerOrganizationId,
          correlationId,
          payload: {
            dteId: id,
            number: row.number,
            status: next,
            reason: dto.reason.trim(),
            feePaid: Boolean(dto.feePaid),
          },
        },
        tx,
      );
      return saved;
    });

    return presentDte(updated, actor, now);
  }

  // =========================================================================
  // Cierre en sala (SITA)
  // =========================================================================

  /**
   * CU-12 / especificacion 6. La sala confirma el arribo con el numero y el
   * codigo de cierre impresos y las alzas reales. Qreal nunca puede superar lo
   * declarado: ese caso exige anular y reemitir, no "corregir" el cierre.
   */
  async close(
    id: string,
    dto: CloseDteRequestDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ) {
    this.access.assertCanWrite(actor);
    const now = new Date();
    let row = await this.reads.findVisible(id, actor);
    assertReceiver(actor, row.destinationOrganizationId);

    const target = await this.movements.findRaw(row.movementId);
    const [received] = await this.db
      .select()
      .from(reception)
      .where(eq(reception.movementId, row.movementId))
      .limit(1);

    const at = dto.closedAt
      ? new Date(dto.closedAt)
      : dto.arrivalAt
        ? new Date(dto.arrivalAt)
        : now;
    const apiSem = row.movementTypeCode === DTE_RULES.movementTypeCode;
    const current = effectiveStatus(row.status, row, at);

    if (apiSem ? !OPEN_FOR_CLOSE.includes(current) : current !== 'EMITIDO') {
      throw this.notClosable(current, row);
    }
    if (!['RECEIVED', 'PARTIALLY_RECEIVED'].includes(target.status)) {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'MOVIMIENTO_NO_RECIBIDO',
        `El DT-e solo puede cerrarse una vez recibido el movimiento. Estado actual: ${target.status}.`,
      );
    }

    let confirmed: number | null = null;
    let verificationCode = row.verificationCode;
    if (apiSem) {
      if (dto.number && dto.number.trim() !== (row.number ?? '').trim()) {
        throw new DomainRuleException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'NUMERO_DTE_NO_COINCIDE',
          `El numero ingresado (${dto.number.trim()}) no coincide con el del DT-e (${row.number ?? 'sin numero'}).`,
        );
      }
      if (row.verificationCode) {
        if (!dto.verificationCode) {
          throw new DomainRuleException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'CODIGO_CIERRE_REQUERIDO',
            'Ingresa el codigo de cierre impreso en el DT-e.',
          );
        }
        if (normalizeCode(dto.verificationCode) !== normalizeCode(row.verificationCode)) {
          throw new DomainRuleException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'CODIGO_CIERRE_INVALIDO',
            'El codigo de cierre no coincide con el del DT-e.',
          );
        }
      } else if (dto.verificationCode) {
        verificationCode = dto.verificationCode.trim();
      }

      confirmed =
        dto.confirmedQuantity ??
        (received && received.unit === 'ALZA'
          ? Math.round(Number(received.receivedQuantity))
          : null);
      if (row.declaredQuantity !== null && confirmed === null) {
        throw new DomainRuleException(
          HttpStatus.BAD_REQUEST,
          'CANTIDAD_REAL_REQUERIDA',
          'Indica las alzas efectivamente recibidas (confirmedQuantity).',
        );
      }
      if (confirmed !== null) {
        const violation = validateConfirmedQuantity(row.declaredQuantity, confirmed);
        if (violation) {
          throw new DomainRuleException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            violation.code,
            violation.message,
            {
              declaredQuantity: row.declaredQuantity,
              confirmedQuantity: confirmed,
              minimumToDeclare: confirmed,
            },
          );
        }
      }
    }

    const arrivalAt = dto.arrivalAt ? new Date(dto.arrivalAt) : (received?.receivedAt ?? at);

    const updated = await this.db.transaction(async (tx) => {
      row = await this.lifecycle.advance(row, at, tx);
      const [saved] = await tx
        .update(dte)
        .set({
          status: 'CERRADO',
          closedAt: at,
          arrivalAt,
          confirmedQuantity: confirmed,
          verificationCode,
          externalStatus: 'CERRADO',
          updatedAt: now,
        })
        .where(and(eq(dte.id, id), eq(dte.status, row.status)))
        .returning();
      if (!saved) this.concurrentChange();

      await this.queries.recordTransition(tx, {
        dteId: id,
        from: row.status,
        to: 'CERRADO',
        source: 'USUARIO',
        reason:
          confirmed !== null
            ? `Cierre en sala: ${confirmed} de ${row.declaredQuantity ?? '?'} alzas declaradas.${dto.notes ? ` ${dto.notes}` : ''}`
            : `Cierre por la sala receptora.${dto.notes ? ` ${dto.notes}` : ''}`,
        actorUserId: actor.id,
        correlationId,
        occurredAt: at,
      });
      await this.events.publish(
        {
          eventType: DomainEvents.DteClosed,
          entityType: 'movement',
          entityId: row.movementId,
          actorUserId: actor.id,
          organizationId: row.destinationOrganizationId,
          correlationId,
          occurredAt: at,
          payload: {
            dteId: id,
            number: row.number,
            closedAt: at.toISOString(),
            confirmedQuantity: confirmed,
            declaredQuantity: row.declaredQuantity,
          },
        },
        tx,
      );
      return saved;
    });

    return presentDte(updated, actor, now);
  }

  /** POST /movements/:id/dte/close: cierre del DT-e en juego del movimiento. */
  async closeForMovement(
    movementId: string,
    dto: CloseDteDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ) {
    await this.movements.findOne(movementId, actor);
    const current = await this.queries.currentForMovement(movementId);
    if (!current) throw new NotFoundException('El movimiento no tiene un DT-e asociado.');
    return this.close(current.id, dto, actor, correlationId);
  }

  /** La sala declara que la carga nunca llego (estado SIN ARRIBO, seccion 5.1). */
  async reportNoArrival(
    id: string,
    dto: NoArrivalDteDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ) {
    this.access.assertCanWrite(actor);
    const now = new Date();
    let row = await this.reads.findVisible(id, actor);
    assertReceiver(actor, row.destinationOrganizationId);

    const current = effectiveStatus(row.status, row, now);
    if (!OPEN_FOR_CLOSE.includes(current)) {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'DTE_NO_ADMITE_SIN_ARRIBO',
        `Solo un DT-e vigente o vencido puede declararse sin arribo; este esta ${current}.`,
      );
    }
    const target = await this.movements.findRaw(row.movementId);
    if (['RECEIVED', 'PARTIALLY_RECEIVED'].includes(target.status)) {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'MOVIMIENTO_RECIBIDO',
        'El movimiento ya tiene la recepcion registrada: la carga arribo. Corresponde cerrar el DT-e.',
      );
    }

    const updated = await this.db.transaction(async (tx) => {
      row = await this.lifecycle.advance(row, now, tx);
      const [saved] = await tx
        .update(dte)
        .set({ status: 'SIN_ARRIBO', externalStatus: 'SIN_ARRIBO', updatedAt: now })
        .where(and(eq(dte.id, id), eq(dte.status, row.status)))
        .returning();
      if (!saved) this.concurrentChange();

      await this.queries.recordTransition(tx, {
        dteId: id,
        from: row.status,
        to: 'SIN_ARRIBO',
        source: 'USUARIO',
        reason: dto.reason.trim(),
        actorUserId: actor.id,
        correlationId,
      });
      await this.events.publish(
        {
          eventType: DomainEvents.DteNoArrival,
          entityType: 'movement',
          entityId: row.movementId,
          actorUserId: actor.id,
          organizationId: row.destinationOrganizationId,
          correlationId,
          payload: { dteId: id, number: row.number, reason: dto.reason.trim() },
        },
        tx,
      );
      return saved;
    });

    return presentDte(updated, actor, now);
  }

  /**
   * Un CADUCADO bloquea al titular en SIGSA hasta que SENASA lo regulariza. La
   * plataforma replica el bloqueo y un ADMIN lo levanta al constatar la
   * regularizacion (la nota queda en el historial).
   */
  async regularize(
    id: string,
    dto: RegularizeDteDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ) {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un ADMIN registra la regularizacion ante SENASA.');
    }
    const now = new Date();
    let row = await this.reads.findVisible(id, actor);
    row = await this.lifecycle.advance(row, now);
    if (row.status !== 'CADUCADO' || row.regularizedAt) {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'DTE_NO_REGULARIZABLE',
        row.regularizedAt
          ? 'El DT-e ya fue regularizado.'
          : `Solo un DT-e caducado se regulariza; este esta ${row.status}.`,
      );
    }

    const updated = await this.db.transaction(async (tx) => {
      const [saved] = await tx
        .update(dte)
        .set({
          regularizedAt: now,
          regularizedById: actor.id,
          regularizationNote: dto.note.trim(),
          updatedAt: now,
        })
        .where(eq(dte.id, id))
        .returning();
      await this.queries.recordTransition(tx, {
        dteId: id,
        from: 'CADUCADO',
        to: 'CADUCADO',
        source: 'USUARIO',
        reason: `Regularizado ante SENASA: ${dto.note.trim()}`,
        actorUserId: actor.id,
        correlationId,
      });
      await this.events.publish(
        {
          eventType: DomainEvents.DteRegularized,
          entityType: 'movement',
          entityId: row.movementId,
          actorUserId: actor.id,
          correlationId,
          payload: { dteId: id, number: row.number, note: dto.note.trim() },
        },
        tx,
      );
      return saved;
    });
    return presentDte(updated, actor, now);
  }

  /**
   * @deprecated POST /movements/:id/dte/status. Traduce los estados anteriores
   * (ISSUED, APPROVED, REJECTED, CANCELLED) al ciclo oficial.
   */
  async updateStatusLegacy(
    movementId: string,
    dto: UpdateDteStatusDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ) {
    this.access.assertCanWrite(actor);
    await this.movements.findOne(movementId, actor);
    const current = await this.queries.currentForMovement(movementId);
    if (!current) throw new NotFoundException('El movimiento no tiene un DT-e asociado.');

    switch (dto.status) {
      case 'ISSUED': {
        const number = dto.number ?? current.number;
        if (!number) {
          throw new DomainRuleException(
            HttpStatus.CONFLICT,
            'NUMERO_REQUERIDO',
            'Para emitir se requiere el numero de DT-e.',
          );
        }
        return this.issue(current.id, { number }, actor, correlationId);
      }
      case 'CANCELLED':
        return this.void(
          current.id,
          { reason: dto.reason ?? 'Cancelado desde la API anterior.', feePaid: false },
          actor,
          correlationId,
        );
      case 'REJECTED': {
        if (!['BORRADOR', 'SOLICITADO'].includes(current.status)) {
          throw new DomainRuleException(
            HttpStatus.CONFLICT,
            'TRANSICION_INVALIDA',
            `Transicion invalida del DT-e: ${current.status} -> RECHAZADO.`,
          );
        }
        const saved = await this.db.transaction(async (tx) => {
          const [row] = await tx
            .update(dte)
            .set({ status: 'RECHAZADO', errorMessage: dto.reason ?? null, updatedAt: new Date() })
            .where(and(eq(dte.id, current.id), eq(dte.status, current.status)))
            .returning();
          if (!row) this.concurrentChange();
          await this.queries.recordTransition(tx, {
            dteId: current.id,
            from: current.status,
            to: 'RECHAZADO',
            source: 'USUARIO',
            reason: dto.reason ?? 'Rechazado.',
            actorUserId: actor.id,
            correlationId,
          });
          await this.events.publish(
            {
              eventType: DomainEvents.DteRejected,
              entityType: 'movement',
              entityId: movementId,
              actorUserId: actor.id,
              correlationId,
              payload: { dteId: current.id, reason: dto.reason ?? null },
            },
            tx,
          );
          return row;
        });
        return presentDte(saved, actor);
      }
      default:
        // APPROVED no existe en el ciclo oficial: se acepta sin cambios.
        return presentDte(current, actor);
    }
  }

  // =========================================================================
  // Internos
  // =========================================================================

  private async publishRequested(
    tx: DbExecutor,
    row: DteRow,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<void> {
    await this.events.publish(
      {
        eventType: DomainEvents.DteRequested,
        entityType: 'movement',
        entityId: row.movementId,
        actorUserId: actor.id,
        organizationId: row.issuerOrganizationId,
        correlationId,
        payload: { dteId: row.id, mode: this.gateway.mode },
      },
      tx,
    );
  }

  private gatewayIssueMode(): 'SIMULADO' | 'SIGSA' {
    return this.gateway.mode === 'simulado' ? 'SIMULADO' : 'SIGSA';
  }

  private assertGatewayCanEmit(): void {
    if (!this.gateway.capabilities.emit) {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'EMISION_API_NO_DISPONIBLE',
        `${this.gateway.description} Emiti el DT-e en SIGSA y registra su numero.`,
        { mode: this.gateway.mode },
      );
    }
  }

  private async assertNumberAvailable(number: string, exceptId?: string): Promise<void> {
    const conditions: SQL[] = [
      eq(dte.number, number),
      eq(dte.movementTypeCode, DTE_RULES.movementTypeCode),
    ];
    if (exceptId) conditions.push(ne(dte.id, exceptId));
    const rows = await this.db
      .select({ id: dte.id })
      .from(dte)
      .where(and(...conditions))
      .limit(1);
    if (rows.length > 0) {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'NUMERO_DTE_DUPLICADO',
        `El DT-e ${number} ya esta registrado en ApiTrace.`,
      );
    }
  }

  private async assertNoActiveDte(movementId: string): Promise<void> {
    const current = await this.queries.currentForMovement(movementId);
    if (current && !isVoid(current.status)) {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'DTE_ACTIVO_EXISTENTE',
        'El movimiento ya tiene un DT-e en juego. Para reemplazarlo, anulalo primero.',
      );
    }
  }

  private assertMovementAcceptsDte(target: MovementRow): void {
    if (['RECEIVED', 'PARTIALLY_RECEIVED', 'REJECTED', 'CANCELLED'].includes(target.status)) {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'MOVIMIENTO_CERRADO',
        `No se puede emitir un DT-e para un movimiento en estado ${target.status}.`,
      );
    }
  }

  private isApiSem(target: MovementRow, ctx: DteContext): boolean {
    return (
      target.requiredDocumentType === 'DTE' ||
      (target.materialType === 'MATERIAL_MELARIO' && ctx.destination.type === 'SALA_EXTRACCION')
    );
  }

  private notClosable(current: DteStatus, row: DteRow): DomainRuleException {
    switch (current) {
      case 'EMITIDO':
        return new DomainRuleException(
          HttpStatus.CONFLICT,
          'DTE_NO_VIGENTE',
          `El DT-e todavia no esta vigente (se habilita el ${row.loadDate} a las 00:00): no puede cerrarse.`,
        );
      case 'CADUCADO':
        return new DomainRuleException(
          HttpStatus.CONFLICT,
          'DTE_CADUCADO',
          'El DT-e caduco: ya no admite cierre. El titular debe regularizar ante SENASA.',
        );
      case 'CERRADO':
        return new DomainRuleException(
          HttpStatus.CONFLICT,
          'DTE_YA_CERRADO',
          'El DT-e ya esta cerrado.',
        );
      default:
        return new DomainRuleException(
          HttpStatus.CONFLICT,
          'TRANSICION_INVALIDA',
          `Transicion invalida del DT-e: ${current} -> CERRADO.`,
        );
    }
  }

  private async insertDocument(
    tx: DbExecutor,
    row: DteRow,
    actor: AuthenticatedUser,
  ): Promise<void> {
    await tx.insert(document).values({
      type: 'DTE',
      number: row.number,
      movementId: row.movementId,
      issuedAt: row.issuedAt,
      externalSystem: 'SENASA_SIGSA',
      externalId: row.externalId,
      metadata: { dteId: row.id } as never,
      createdById: actor.id,
    });
  }

  private concurrentChange(): never {
    throw new DomainRuleException(
      HttpStatus.CONFLICT,
      'CAMBIO_CONCURRENTE',
      'El DT-e cambio mientras se procesaba la operacion. Actualiza y volve a intentar.',
    );
  }
}
