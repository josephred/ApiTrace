import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { producer, renapaRegistration, senasaDelegation } from '../../database/schema';
import { AccessControlService } from '../../common/services/access-control.service';
import { DomainEvents, EventsService } from '../../common/services/events.service';
import type { AuthenticatedUser } from '../../common/types';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  SENASA_SERVICES,
  type AssociateRenapaDto,
  type CreateProducerDto,
  type UpdateProducerDto,
  type UpsertSenasaDelegationDto,
} from './dto/producer.dto';

const normalizeTaxId = (value?: string | null): string | null =>
  value ? value.replace(/-/g, '') : null;

@Injectable()
export class ProducerService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessControlService,
    private readonly events: EventsService,
  ) {}

  /** CU-04. */
  async create(dto: CreateProducerDto, actor: AuthenticatedUser, correlationId?: string) {
    this.access.assertCanWrite(actor);

    const organizationId =
      dto.organizationId && this.access.hasGlobalScope(actor)
        ? dto.organizationId
        : this.access.requireOrganization(actor);

    const taxId = normalizeTaxId(dto.taxId);
    if (taxId) {
      const existing = await this.db
        .select({ id: producer.id })
        .from(producer)
        .where(eq(producer.taxId, taxId))
        .limit(1);
      if (existing.length > 0) {
        throw new ConflictException(`Ya existe un productor registrado con el CUIT ${dto.taxId}.`);
      }
    }

    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(producer)
        .values({
          organizationId,
          businessName: dto.businessName.trim(),
          personType: dto.personType ?? 'FISICA',
          taxId,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          address: dto.address ?? null,
          province: dto.province ?? null,
          locality: dto.locality ?? null,
          notes: dto.notes ?? null,
          createdById: actor.id,
        })
        .returning();

      await this.events.publish(
        {
          eventType: DomainEvents.ProducerRegistered,
          entityType: 'producer',
          entityId: created.id,
          actorUserId: actor.id,
          organizationId,
          correlationId,
          payload: { businessName: created.businessName, taxId: created.taxId },
        },
        tx,
      );

      return created;
    });
  }

  async list(query: PaginationQueryDto, actor: AuthenticatedUser) {
    const conditions: SQL[] = [];
    const scope = this.access.organizationScope(actor);
    if (scope) conditions.push(eq(producer.organizationId, scope));
    if (query.q) {
      const like = `%${query.q}%`;
      const search = or(ilike(producer.businessName, like), ilike(producer.taxId, like));
      if (search) conditions.push(search);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(producer)
        .where(where)
        .orderBy(asc(producer.businessName))
        .limit(query.pageSize)
        .offset(query.offset),
      this.db.select({ count: sql<number>`cast(count(*) as int)` }).from(producer).where(where),
    ]);
    return { rows, total: count };
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const rows = await this.db.select().from(producer).where(eq(producer.id, id)).limit(1);
    if (rows.length === 0) throw new NotFoundException('Productor no encontrado.');
    this.access.assertOrganizationAccess(actor, rows[0].organizationId);
    return rows[0];
  }

  /** Devuelve el productor junto con sus registros RENAPA asociados. */
  async findOneDetailed(id: string, actor: AuthenticatedUser) {
    const record = await this.findOne(id, actor);
    const renapa = await this.db
      .select()
      .from(renapaRegistration)
      .where(eq(renapaRegistration.producerId, id))
      .orderBy(asc(renapaRegistration.createdAt));
    return { ...record, renapa };
  }

  async update(id: string, dto: UpdateProducerDto, actor: AuthenticatedUser) {
    this.access.assertCanWrite(actor);
    const before = await this.findOne(id, actor);

    const taxId = dto.taxId !== undefined ? normalizeTaxId(dto.taxId) : before.taxId;
    if (taxId && taxId !== before.taxId) {
      const existing = await this.db
        .select({ id: producer.id })
        .from(producer)
        .where(eq(producer.taxId, taxId))
        .limit(1);
      if (existing.length > 0 && existing[0].id !== id) {
        throw new ConflictException('Otro productor ya usa ese CUIT.');
      }
    }

    const [updated] = await this.db
      .update(producer)
      .set({ ...dto, taxId, updatedAt: new Date() })
      .where(eq(producer.id, id))
      .returning();
    return updated;
  }

  /**
   * CU-05. Un RENAPA no puede quedar asociado a dos productores: la unicidad se
   * garantiza en base de datos y se traduce aqui a un 409 con mensaje util.
   */
  async associateRenapa(
    producerId: string,
    dto: AssociateRenapaDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ) {
    this.access.assertCanWrite(actor);
    const target = await this.findOne(producerId, actor);

    const number = dto.number.trim();
    const existing = await this.db
      .select()
      .from(renapaRegistration)
      .where(eq(renapaRegistration.number, number))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(
        existing[0].producerId === producerId
          ? 'El RENAPA ya esta asociado a este productor.'
          : 'El RENAPA ya esta asociado a otro productor.',
      );
    }

    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(renapaRegistration)
        .values({
          producerId,
          number,
          status: dto.status ?? 'PENDING_VERIFICATION',
          issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
          externalSystem: 'MANUAL',
          // Sin integracion viva con SENASA, la carga manual queda pendiente de sincronizar.
          syncStatus: 'PENDING_SYNC',
          sourceNote: dto.sourceNote ?? 'Carga manual',
        })
        .returning();

      await this.events.publish(
        {
          eventType: DomainEvents.RenapaAssociated,
          entityType: 'producer',
          entityId: producerId,
          actorUserId: actor.id,
          organizationId: target.organizationId,
          correlationId,
          payload: { renapaId: created.id, number: created.number, status: created.status },
        },
        tx,
      );

      return created;
    });
  }

  async listRenapa(producerId: string, actor: AuthenticatedUser) {
    await this.findOne(producerId, actor);
    return this.db
      .select()
      .from(renapaRegistration)
      .where(eq(renapaRegistration.producerId, producerId))
      .orderBy(asc(renapaRegistration.createdAt));
  }

  /**
   * Delegaciones SENASA del titular, una por servicio. Los servicios sin
   * registro se informan como NO_INICIADA para que la pantalla muestre siempre
   * el cuadro completo.
   */
  async listDelegations(producerId: string, actor: AuthenticatedUser) {
    await this.findOne(producerId, actor);
    const rows = await this.db
      .select()
      .from(senasaDelegation)
      .where(eq(senasaDelegation.producerId, producerId));
    return SENASA_SERVICES.map(
      (service) =>
        rows.find((row) => row.service === service) ?? {
          id: null,
          producerId,
          service,
          status: 'NO_INICIADA' as const,
          delegatedToTaxId: null,
          formNumber: null,
          requestedAt: null,
          acceptedAt: null,
          revokedAt: null,
          notes: null,
          updatedById: null,
          createdAt: null,
          updatedAt: null,
        },
    );
  }

  async upsertDelegation(
    producerId: string,
    service: (typeof SENASA_SERVICES)[number],
    dto: UpsertSenasaDelegationDto,
    actor: AuthenticatedUser,
  ) {
    this.access.assertCanWrite(actor);
    await this.findOne(producerId, actor);
    const now = new Date();
    const stamps = {
      requestedAt: dto.status === 'PENDIENTE' ? now : undefined,
      acceptedAt: dto.status === 'ACEPTADA' ? now : undefined,
      revokedAt: dto.status === 'REVOCADA' ? now : undefined,
    };
    const values = {
      status: dto.status,
      formNumber: dto.formNumber ?? null,
      delegatedToTaxId: dto.delegatedToTaxId?.replace(/-/g, '') ?? null,
      notes: dto.notes ?? null,
      updatedById: actor.id,
      updatedAt: now,
    };

    const [saved] = await this.db
      .insert(senasaDelegation)
      .values({ producerId, service, ...values, ...stamps })
      .onConflictDoUpdate({
        target: [senasaDelegation.producerId, senasaDelegation.service],
        set: {
          ...values,
          ...Object.fromEntries(Object.entries(stamps).filter(([, value]) => value !== undefined)),
        },
      })
      .returning();
    return saved;
  }
}
