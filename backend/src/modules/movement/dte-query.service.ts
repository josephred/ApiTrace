import {
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DRIZZLE, type Database } from '../../database/database.module';
import { apiary, dte, establishment, movement, producer, reception } from '../../database/schema';
import { AccessControlService } from '../../common/services/access-control.service';
import { DomainRuleException } from '../../common/exceptions/domain-rule.exception';
import { paginated } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/types';
import { MovementService } from './movement.service';
import { DteQueries, type DteRow } from './dte.queries';
import { DteLifecycleService } from './dte-lifecycle.service';
import { DteChecksService } from './dte-checks.service';
import { presentDte } from './dte.presenter';
import { assertIssuer, perspectiveOf } from './dte.access';
import { draftViolations, normalizeDraft } from './dte.draft';
import {
  DTE_RULES,
  addDays,
  defaultExpiryDate,
  effectiveStatus,
  suggestDeclaredQuantity,
  toArDate,
  type DteStatus,
} from './dte.rules';
import { SENASA_GATEWAY, type SenasaGateway } from './senasa/senasa.gateway';
import type { DteAction, DteCheck, DteContext, MovementRow } from './dte.types';
import type { ListDteQueryDto, PreflightDteDto } from './dto/dte.dto';

const OPEN_FOR_VOID: DteStatus[] = ['BORRADOR', 'SOLICITADO', 'EMITIDO', 'VIGENTE'];
const OPEN_FOR_CLOSE: DteStatus[] = ['VIGENTE', 'VENCIDO'];

/**
 * Lecturas del DT-e por usuario: listado, detalle, resumen para el panel y
 * verificacion previa. Antes de leer persiste las transiciones del reloj
 * pendientes (DteLifecycleService.refresh), asi un filtro por estado nunca
 * devuelve como "vigente" un DT-e que ya vencio.
 */
@Injectable()
export class DteQueryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessControlService,
    private readonly movements: MovementService,
    private readonly queries: DteQueries,
    private readonly lifecycle: DteLifecycleService,
    private readonly checks: DteChecksService,
    @Inject(SENASA_GATEWAY) private readonly gateway: SenasaGateway,
  ) {}

  /** El DT-e, si el usuario puede verlo: emite, recibe o tiene alcance global. */
  async findVisible(id: string, actor: AuthenticatedUser): Promise<DteRow> {
    const row = await this.queries.findById(id);
    if (!row) throw new NotFoundException('DT-e no encontrado.');
    if (this.access.hasGlobalScope(actor)) return row;
    if (
      actor.organizationId &&
      (actor.organizationId === row.issuerOrganizationId ||
        actor.organizationId === row.destinationOrganizationId)
    ) {
      return row;
    }
    throw new ForbiddenException('El DT-e no involucra a su organizacion.');
  }

  async getByMovement(movementId: string, actor: AuthenticatedUser) {
    await this.movements.findOne(movementId, actor);
    const current = await this.queries.currentForMovement(movementId);
    if (!current) throw new NotFoundException('El movimiento no tiene un DT-e asociado.');
    const row = await this.lifecycle.advance(current, new Date());
    return presentDte(row, actor);
  }

  /**
   * DT-e del ambito del usuario: los que emite su organizacion, los que llegan a
   * sus salas, o ambos. ADMIN y AUDITOR ven todos.
   */
  async list(query: ListDteQueryDto, actor: AuthenticatedUser) {
    const now = new Date();
    const scope = this.access.organizationScope(actor);
    await this.lifecycle.refresh({ organizationId: scope }, now);

    const originEstablishment = alias(establishment, 'origin_establishment');
    const destinationEstablishment = alias(establishment, 'destination_establishment');

    const conditions: SQL[] = [];
    if (scope) {
      const perspective = query.perspective ?? 'todos';
      const byScope =
        perspective === 'emitidos'
          ? eq(dte.issuerOrganizationId, scope)
          : perspective === 'recibidos'
            ? eq(dte.destinationOrganizationId, scope)
            : or(eq(dte.issuerOrganizationId, scope), eq(dte.destinationOrganizationId, scope));
      if (byScope) conditions.push(byScope);
    }
    if (query.status) conditions.push(eq(dte.status, query.status));
    if (query.mine) conditions.push(eq(dte.requestedById, actor.id));
    if (query.from) conditions.push(gte(dte.loadDate, query.from));
    if (query.to) conditions.push(lte(dte.loadDate, query.to));
    if (query.holderProducerId) conditions.push(eq(dte.holderProducerId, query.holderProducerId));
    if (query.q) {
      const like = `%${query.q}%`;
      const search = or(
        ilike(dte.number, like),
        ilike(movement.code, like),
        ilike(dte.originCode, like),
        ilike(dte.destinationCode, like),
      );
      if (search) conditions.push(search);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const base = this.db
      .select({
        dte,
        movementCode: movement.code,
        movementStatus: movement.status,
        apiaryCode: apiary.code,
        apiaryName: apiary.name,
        originName: originEstablishment.name,
        destinationName: destinationEstablishment.name,
        holderName: producer.businessName,
      })
      .from(dte)
      .innerJoin(movement, eq(movement.id, dte.movementId))
      .leftJoin(apiary, eq(apiary.id, movement.originApiaryId))
      .innerJoin(originEstablishment, eq(originEstablishment.id, movement.originEstablishmentId))
      .innerJoin(
        destinationEstablishment,
        eq(destinationEstablishment.id, movement.destinationEstablishmentId),
      )
      .leftJoin(producer, eq(producer.id, dte.holderProducerId));

    const [rows, [{ count }]] = await Promise.all([
      base.where(where).orderBy(desc(dte.createdAt)).limit(query.pageSize).offset(query.offset),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(dte)
        .innerJoin(movement, eq(movement.id, dte.movementId))
        .where(where),
    ]);

    const data = rows.map((row) => ({
      ...presentDte(row.dte, actor, now),
      movementCode: row.movementCode,
      movementStatus: row.movementStatus,
      apiaryCode: row.apiaryCode,
      apiaryName: row.apiaryName,
      originName: row.originName,
      destinationName: row.destinationName,
      holderName: row.holderName,
      perspective: perspectiveOf(row.dte, actor),
    }));
    return paginated(data, count, query);
  }

  /** Detalle con historial, extremos, documentos relacionados y acciones posibles. */
  async findOne(id: string, actor: AuthenticatedUser) {
    const now = new Date();
    let row = await this.findVisible(id, actor);
    row = await this.lifecycle.advance(row, now);

    const target = await this.movements.findRaw(row.movementId);
    const ctx = await this.checks.contextForMovement(target);
    const [history, related, [received]] = await Promise.all([
      this.queries.history(id),
      this.queries.listForMovement(row.movementId),
      this.db.select().from(reception).where(eq(reception.movementId, row.movementId)).limit(1),
    ]);

    return {
      ...presentDte(row, actor, now),
      perspective: perspectiveOf(row, actor),
      movement: {
        id: target.id,
        code: target.code,
        status: target.status,
        scheduledAt: target.scheduledAt,
        dispatchedAt: target.dispatchedAt,
        receivedAt: target.receivedAt,
        quantity: target.quantity,
        unit: target.unit,
        requiresDocument: target.requiresDocument,
        driverName: target.driverName,
      },
      reception: received
        ? {
            receivedAt: received.receivedAt,
            receivedQuantity: received.receivedQuantity,
            unit: received.unit,
            result: received.result,
          }
        : null,
      origin: { id: ctx.origin.id, name: ctx.origin.name, type: ctx.origin.type },
      apiary: ctx.apiary
        ? {
            id: ctx.apiary.id,
            code: ctx.apiary.code,
            name: ctx.apiary.name,
            renapaCode: ctx.apiary.renapaCode,
            renapaStatus: ctx.apiary.renapaStatus,
            locality: ctx.apiary.locality,
            province: ctx.apiary.province,
          }
        : null,
      destination: {
        id: ctx.destination.id,
        name: ctx.destination.name,
        type: ctx.destination.type,
        senasaCode: ctx.destination.senasaCode,
        senasaStatus: ctx.destination.senasaStatus,
        locality: ctx.destination.locality,
        province: ctx.destination.province,
      },
      holder: ctx.holder
        ? { id: ctx.holder.id, businessName: ctx.holder.businessName, taxId: ctx.holder.taxId }
        : null,
      history,
      related: related
        .filter((other) => other.id !== row.id)
        .map((other) => ({
          id: other.id,
          number: other.number,
          status: effectiveStatus(other.status, other, now),
          createdAt: other.createdAt,
          voidReason: other.voidReason,
        })),
      allowedActions: this.allowedActions(row, actor, target, now),
      integration: this.integrationInfo(),
    };
  }

  /** Tablero del usuario: cuantos hay en cada estado y que requiere accion. */
  async summary(actor: AuthenticatedUser) {
    const now = new Date();
    const today = toArDate(now);
    const scope = this.access.organizationScope(actor);
    await this.lifecycle.refresh({ organizationId: scope }, now);

    const issuedBy = scope ? eq(dte.issuerOrganizationId, scope) : undefined;
    const receivedBy = scope ? eq(dte.destinationOrganizationId, scope) : undefined;

    const countByStatus = async (condition: SQL | undefined) => {
      const rows = await this.db
        .select({ status: dte.status, count: sql<number>`cast(count(*) as int)` })
        .from(dte)
        .where(condition)
        .groupBy(dte.status);
      return Object.fromEntries(rows.map((row) => [row.status, row.count])) as Record<
        string,
        number
      >;
    };
    const countWhere = async (...conditions: (SQL | undefined)[]) => {
      const rows = await this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(dte)
        .where(and(...conditions.filter((c): c is SQL => Boolean(c))));
      return rows[0]?.count ?? 0;
    };

    const [issued, received, requestErrors, expiringToday, lapsed, pendingClosure, blocked] =
      await Promise.all([
        countByStatus(issuedBy),
        countByStatus(receivedBy),
        countWhere(issuedBy, eq(dte.status, 'SOLICITADO'), eq(dte.syncStatus, 'ERROR')),
        countWhere(issuedBy, eq(dte.status, 'VIGENTE'), eq(dte.expiryDate, today)),
        countWhere(issuedBy, eq(dte.status, 'CADUCADO'), isNull(dte.regularizedAt)),
        countWhere(receivedBy, inArray(dte.status, ['VIGENTE', 'VENCIDO'])),
        this.db
          .selectDistinct({ id: producer.id, businessName: producer.businessName })
          .from(dte)
          .innerJoin(producer, eq(producer.id, dte.holderProducerId))
          .where(
            and(
              ...[issuedBy, eq(dte.status, 'CADUCADO'), isNull(dte.regularizedAt)].filter(
                (c): c is SQL => Boolean(c),
              ),
            ),
          ),
      ]);

    return {
      issued,
      received,
      tasks: {
        draftsToIssue: issued.BORRADOR ?? 0,
        requestErrors,
        expiringToday,
        expired: issued.VENCIDO ?? 0,
        lapsed,
        pendingClosure,
        receivedExpired: received.VENCIDO ?? 0,
      },
      blockedHolders: blocked,
      integration: this.integrationInfo(),
      generatedAt: now.toISOString(),
    };
  }

  /** Verificacion previa sin efectos: lo que SIGSA revisaria antes de emitir. */
  async preflight(dto: PreflightDteDto, actor: AuthenticatedUser) {
    const now = new Date();
    let ctx: DteContext;
    if (dto.movementId) {
      const found = await this.movements.findOne(dto.movementId, actor);
      ctx = await this.checks.contextForMovement(found);
      assertIssuer(actor, ctx.origin.organizationId);
    } else {
      if (!dto.apiaryId || !dto.destinationEstablishmentId) {
        throw new DomainRuleException(
          HttpStatus.BAD_REQUEST,
          'ORIGEN_DESTINO_REQUERIDOS',
          'Indica el apiario de origen y la sala de destino, o un movimiento existente.',
        );
      }
      ctx = await this.checks.contextForNew(dto.apiaryId, dto.destinationEstablishmentId);
      assertIssuer(actor, ctx.origin.organizationId);
    }

    const draft = normalizeDraft(dto);
    const checks = await this.checks.buildChecks(ctx, draft, { forSubmission: true, now });
    const hardRules = draftViolations(draft).map<DteCheck>((violation) => ({
      code: violation.code,
      label: 'Datos del tramite',
      status: 'error',
      message: violation.message,
    }));
    const all = [...hardRules, ...checks];

    return {
      ok: !all.some((check) => check.status === 'error'),
      mode: this.gateway.mode,
      checks: all,
      suggestion: {
        declaredQuantity: draft.estimatedQuantity
          ? suggestDeclaredQuantity(draft.estimatedQuantity)
          : null,
        expiryDate: defaultExpiryDate(draft.loadDate),
        maxExpiryDate: addDays(draft.loadDate, DTE_RULES.maxValidityDays),
        earliestRequestDate: addDays(draft.loadDate, -DTE_RULES.maxAnticipationDays),
      },
    };
  }

  integrationInfo() {
    return {
      mode: this.gateway.mode,
      environment: this.gateway.environment,
      description: this.gateway.description,
      capabilities: this.gateway.capabilities,
      rules: DTE_RULES,
    };
  }

  private allowedActions(
    row: DteRow,
    actor: AuthenticatedUser,
    target: MovementRow,
    now: Date,
  ): DteAction[] {
    if (this.access.isReadOnly(actor)) return row.number ? ['print'] : [];
    const actions: DteAction[] = [];
    const current = effectiveStatus(row.status, row, now);
    const isAdmin = actor.role === 'ADMIN';
    const issuer = isAdmin || actor.organizationId === row.issuerOrganizationId;
    const receiver = isAdmin || actor.organizationId === row.destinationOrganizationId;
    const apiSem = row.movementTypeCode === DTE_RULES.movementTypeCode;
    const received = ['RECEIVED', 'PARTIALLY_RECEIVED'].includes(target.status);

    if (issuer && current === 'BORRADOR') {
      if (apiSem) actions.push('edit');
      actions.push('issueManual');
      if (apiSem && this.gateway.capabilities.emit) actions.push('requestEmission');
    }
    if (issuer && OPEN_FOR_VOID.includes(current)) actions.push('void');
    if (receiver) {
      if (apiSem && OPEN_FOR_CLOSE.includes(current)) {
        actions.push(received ? 'close' : 'noArrival');
      } else if (!apiSem && current === 'EMITIDO' && received) {
        actions.push('close');
      }
    }
    if (isAdmin && current === 'CADUCADO' && !row.regularizedAt) actions.push('regularize');
    if (row.number && !['ELIMINADO', 'RECHAZADO'].includes(current)) actions.push('print');
    return actions;
  }
}
