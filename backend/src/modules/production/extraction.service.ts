import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { extraction, extractionInput, movement } from '../../database/schema';
import { AccessControlService } from '../../common/services/access-control.service';
import { CodeService } from '../../common/services/code.service';
import { DomainEvents, EventsService } from '../../common/services/events.service';
import { toNumber } from '../../common/utils/numbers';
import { DomainRuleException } from '../../common/exceptions/domain-rule.exception';
import { EstablishmentService } from '../establishment/establishment.service';
import { DteQueries } from '../movement/dte.queries';
import type { AuthenticatedUser } from '../../common/types';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { CompleteExtractionDto, CreateExtractionDto } from './dto/production.dto';

@Injectable()
export class ExtractionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessControlService,
    private readonly events: EventsService,
    private readonly codes: CodeService,
    private readonly establishments: EstablishmentService,
    private readonly dtes: DteQueries,
  ) {}

  /**
   * CU-13. Una extraccion solo puede consumir movimientos efectivamente
   * recibidos en esa sala, y ningun movimiento puede alimentar dos extracciones:
   * de lo contrario la misma materia prima aparecería en dos lotes distintos.
   */
  async create(dto: CreateExtractionDto, actor: AuthenticatedUser, correlationId?: string) {
    this.access.assertCanWrite(actor);
    const sala = await this.establishments.findOne(dto.establishmentId, actor);

    const movementIds = dto.inputs.map((input) => input.movementId);
    if (new Set(movementIds).size !== movementIds.length) {
      throw new BadRequestException('Hay movimientos repetidos en las entradas.');
    }

    const sources = await this.db
      .select()
      .from(movement)
      .where(inArray(movement.id, movementIds));

    if (sources.length !== movementIds.length) {
      const found = new Set(sources.map((row) => row.id));
      const missing = movementIds.filter((id) => !found.has(id));
      throw new NotFoundException(`Movimientos inexistentes: ${missing.join(', ')}.`);
    }

    for (const source of sources) {
      if (source.destinationEstablishmentId !== dto.establishmentId) {
        throw new BadRequestException(
          `El movimiento ${source.code} no fue destinado a este establecimiento.`,
        );
      }
      if (!['RECEIVED', 'PARTIALLY_RECEIVED'].includes(source.status)) {
        throw new ConflictException(
          `El movimiento ${source.code} esta en estado ${source.status}; debe estar recibido para procesarse.`,
        );
      }
      // Especificacion 6.2: "Iniciar extraccion" se habilita recien con el DT-e CERRADO.
      if (source.requiresDocument && source.requiredDocumentType === 'DTE') {
        const document = await this.dtes.currentForMovement(source.id);
        if (!document || document.status !== 'CERRADO') {
          throw new DomainRuleException(
            HttpStatus.CONFLICT,
            'DTE_SIN_CERRAR',
            `El movimiento ${source.code} exige DT-e y el documento no esta cerrado: la sala debe cerrarlo antes de iniciar la extraccion.`,
            { movementId: source.id, dteStatus: document?.status ?? null },
          );
        }
      }
    }

    const alreadyUsed = await this.db
      .select({ movementId: extractionInput.movementId })
      .from(extractionInput)
      .where(inArray(extractionInput.movementId, movementIds));
    if (alreadyUsed.length > 0) {
      const codes = sources
        .filter((source) => alreadyUsed.some((used) => used.movementId === source.id))
        .map((source) => source.code);
      throw new ConflictException(
        `Estos movimientos ya fueron procesados en otra extraccion: ${codes.join(', ')}.`,
      );
    }

    const startedAt = new Date(dto.startedAt);
    const finishedAt = dto.finishedAt ? new Date(dto.finishedAt) : null;
    if (finishedAt && finishedAt < startedAt) {
      throw new BadRequestException('finishedAt no puede ser anterior a startedAt.');
    }

    const inputQuantity = dto.inputs.reduce((sum, input) => sum + input.quantity, 0);
    if (dto.outputQuantity && dto.outputQuantity > inputQuantity) {
      throw new BadRequestException(
        `La cantidad obtenida (${dto.outputQuantity}) no puede superar la cantidad ingresada (${inputQuantity}).`,
      );
    }

    return this.db.transaction(async (tx) => {
      const code = await this.codes.next('EXT', tx, startedAt);
      const [created] = await tx
        .insert(extraction)
        .values({
          code,
          establishmentId: dto.establishmentId,
          startedAt,
          finishedAt,
          status: dto.outputQuantity !== undefined ? 'COMPLETED' : 'DRAFT',
          inputQuantity: String(inputQuantity),
          outputQuantity: dto.outputQuantity !== undefined ? String(dto.outputQuantity) : null,
          unit: dto.inputs[0]?.unit ?? 'KG',
          operatorName: dto.operatorName ?? null,
          notes: dto.notes ?? null,
          createdById: actor.id,
        })
        .returning();

      await tx.insert(extractionInput).values(
        dto.inputs.map((input) => ({
          extractionId: created.id,
          movementId: input.movementId,
          quantity: String(input.quantity),
          unit: input.unit ?? 'KG',
        })),
      );

      await this.events.publish(
        {
          eventType: DomainEvents.ExtractionRegistered,
          entityType: 'extraction',
          entityId: created.id,
          actorUserId: actor.id,
          organizationId: sala.organizationId,
          correlationId,
          payload: {
            code: created.code,
            startedAt: startedAt.toISOString(),
            establishmentId: dto.establishmentId,
            movementIds,
            inputQuantity,
            outputQuantity: dto.outputQuantity ?? null,
          },
        },
        tx,
      );

      return created;
    });
  }

  async complete(
    id: string,
    dto: CompleteExtractionDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ) {
    this.access.assertCanWrite(actor);
    const record = await this.findOne(id, actor);
    if (record.status === 'CANCELLED') {
      throw new ConflictException('La extraccion fue cancelada.');
    }
    if (dto.outputQuantity > toNumber(record.inputQuantity)) {
      throw new BadRequestException(
        'La cantidad obtenida no puede superar la cantidad ingresada a la sala.',
      );
    }

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(extraction)
        .set({
          status: 'COMPLETED',
          outputQuantity: String(dto.outputQuantity),
          finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : new Date(),
          updatedAt: new Date(),
        })
        .where(eq(extraction.id, id))
        .returning();

      await this.events.publish(
        {
          eventType: DomainEvents.ExtractionCompleted,
          entityType: 'extraction',
          entityId: id,
          actorUserId: actor.id,
          correlationId,
          payload: {
            code: updated.code,
            outputQuantity: dto.outputQuantity,
            yieldPercent:
              Math.round((dto.outputQuantity / toNumber(record.inputQuantity)) * 10000) / 100,
          },
        },
        tx,
      );
      return updated;
    });
  }

  async list(
    query: PaginationQueryDto,
    actor: AuthenticatedUser,
    filters: { establishmentId?: string } = {},
  ) {
    const scope = this.access.organizationScope(actor);
    const conditions = [];
    if (scope) {
      conditions.push(
        sql`${extraction.establishmentId} IN (SELECT id FROM establishment WHERE organization_id = ${scope})`,
      );
    }
    if (filters.establishmentId) {
      conditions.push(eq(extraction.establishmentId, filters.establishmentId));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(extraction)
        .where(where)
        .orderBy(desc(extraction.startedAt))
        .limit(query.pageSize)
        .offset(query.offset),
      this.db.select({ count: sql<number>`cast(count(*) as int)` }).from(extraction).where(where),
    ]);
    return { rows, total: count };
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const rows = await this.db.select().from(extraction).where(eq(extraction.id, id)).limit(1);
    if (rows.length === 0) throw new NotFoundException('Extraccion no encontrada.');
    const sala = await this.establishments.findRaw(rows[0].establishmentId);
    this.access.assertOrganizationAccess(actor, sala.organizationId);
    return rows[0];
  }

  async findOneDetailed(id: string, actor: AuthenticatedUser) {
    const record = await this.findOne(id, actor);
    const inputs = await this.db
      .select({
        id: extractionInput.id,
        movementId: extractionInput.movementId,
        movementCode: movement.code,
        quantity: extractionInput.quantity,
        unit: extractionInput.unit,
        originEstablishmentId: movement.originEstablishmentId,
        originApiaryId: movement.originApiaryId,
      })
      .from(extractionInput)
      .innerJoin(movement, eq(extractionInput.movementId, movement.id))
      .where(eq(extractionInput.extractionId, id));
    return { ...record, inputs };
  }
}
