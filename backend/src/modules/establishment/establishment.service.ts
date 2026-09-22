import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { establishment, organization, producer, renspaRegistration } from '../../database/schema';
import { AccessControlService } from '../../common/services/access-control.service';
import { DomainEvents, EventsService } from '../../common/services/events.service';
import type { AuthenticatedUser } from '../../common/types';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type {
  AssociateRenspaDto,
  CreateEstablishmentDto,
  ListReceiversQueryDto,
  UpdateEstablishmentDto,
} from './dto/establishment.dto';

@Injectable()
export class EstablishmentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessControlService,
    private readonly events: EventsService,
  ) {}

  /** CU-06 (alta del establecimiento). */
  async create(dto: CreateEstablishmentDto, actor: AuthenticatedUser, correlationId?: string) {
    this.access.assertCanWrite(actor);
    const organizationId =
      dto.organizationId && this.access.hasGlobalScope(actor)
        ? dto.organizationId
        : this.access.requireOrganization(actor);

    if (dto.producerId) {
      const owner = await this.db
        .select({ id: producer.id, organizationId: producer.organizationId })
        .from(producer)
        .where(eq(producer.id, dto.producerId))
        .limit(1);
      if (owner.length === 0) throw new NotFoundException('El productor indicado no existe.');
      this.access.assertOrganizationAccess(actor, owner[0].organizationId);
    }
    const senasaCode = await this.assertSenasaCodeAvailable(dto.senasaCode);

    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(establishment)
        .values({
          organizationId,
          producerId: dto.producerId ?? null,
          name: dto.name.trim(),
          type: dto.type,
          address: dto.address ?? null,
          locality: dto.locality ?? null,
          province: dto.province ?? null,
          latitude: dto.latitude !== undefined ? String(dto.latitude) : null,
          longitude: dto.longitude !== undefined ? String(dto.longitude) : null,
          rne: dto.rne ?? null,
          senasaCode,
          senasaStatus: dto.senasaStatus ?? 'PENDING_VERIFICATION',
          senasaValidTo: dto.senasaValidTo ?? null,
          createdById: actor.id,
        })
        .returning();

      await this.events.publish(
        {
          eventType: DomainEvents.EstablishmentRegistered,
          entityType: 'establishment',
          entityId: created.id,
          actorUserId: actor.id,
          organizationId,
          correlationId,
          payload: { name: created.name, type: created.type },
        },
        tx,
      );
      return created;
    });
  }

  async list(
    query: PaginationQueryDto,
    actor: AuthenticatedUser,
    filters: { type?: string; producerId?: string } = {},
  ) {
    const conditions: SQL[] = [];
    const scope = this.access.organizationScope(actor);
    if (scope) conditions.push(eq(establishment.organizationId, scope));
    if (filters.type) {
      conditions.push(eq(establishment.type, filters.type as never));
    }
    if (filters.producerId) conditions.push(eq(establishment.producerId, filters.producerId));
    if (query.q) {
      const like = `%${query.q}%`;
      const search = or(ilike(establishment.name, like), ilike(establishment.locality, like));
      if (search) conditions.push(search);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(establishment)
        .where(where)
        .orderBy(asc(establishment.name))
        .limit(query.pageSize)
        .offset(query.offset),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(establishment)
        .where(where),
    ]);
    return { rows, total: count };
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const rows = await this.db
      .select()
      .from(establishment)
      .where(eq(establishment.id, id))
      .limit(1);
    if (rows.length === 0) throw new NotFoundException('Establecimiento no encontrado.');
    this.access.assertOrganizationAccess(actor, rows[0].organizationId);
    return rows[0];
  }

  async findOneDetailed(id: string, actor: AuthenticatedUser) {
    const record = await this.findOne(id, actor);
    const renspa = await this.db
      .select()
      .from(renspaRegistration)
      .where(eq(renspaRegistration.establishmentId, id))
      .orderBy(asc(renspaRegistration.createdAt));
    return { ...record, renspa };
  }

  /** Sin control de acceso: uso interno del motor de trazabilidad y de movimientos. */
  async findRaw(id: string) {
    const rows = await this.db
      .select()
      .from(establishment)
      .where(eq(establishment.id, id))
      .limit(1);
    if (rows.length === 0) throw new NotFoundException(`Establecimiento ${id} no encontrado.`);
    return rows[0];
  }

  async findManyRaw(ids: string[]) {
    if (ids.length === 0) return [];
    return this.db.select().from(establishment).where(inArray(establishment.id, ids));
  }

  async update(id: string, dto: UpdateEstablishmentDto, actor: AuthenticatedUser) {
    this.access.assertCanWrite(actor);
    await this.findOne(id, actor);
    const senasaCode =
      dto.senasaCode !== undefined ? await this.assertSenasaCodeAvailable(dto.senasaCode, id) : undefined;
    const [updated] = await this.db
      .update(establishment)
      .set({
        ...dto,
        senasaCode,
        latitude: dto.latitude !== undefined ? String(dto.latitude) : undefined,
        longitude: dto.longitude !== undefined ? String(dto.longitude) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(establishment.id, id))
      .returning();
    return updated;
  }

  /** CU-06 (asociacion del RENSPA). */
  async associateRenspa(
    establishmentId: string,
    dto: AssociateRenspaDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ) {
    this.access.assertCanWrite(actor);
    const target = await this.findOne(establishmentId, actor);

    const owner = await this.db
      .select({ id: producer.id, organizationId: producer.organizationId })
      .from(producer)
      .where(eq(producer.id, dto.producerId))
      .limit(1);
    if (owner.length === 0) throw new NotFoundException('El productor indicado no existe.');
    this.access.assertOrganizationAccess(actor, owner[0].organizationId);

    if (dto.validFrom && dto.validTo && new Date(dto.validFrom) > new Date(dto.validTo)) {
      throw new BadRequestException('validFrom no puede ser posterior a validTo.');
    }

    const number = dto.number.trim();
    const existing = await this.db
      .select()
      .from(renspaRegistration)
      .where(eq(renspaRegistration.number, number))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException(
        existing[0].establishmentId === establishmentId
          ? 'El RENSPA ya esta asociado a este establecimiento.'
          : 'El RENSPA ya esta registrado en otro establecimiento.',
      );
    }

    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(renspaRegistration)
        .values({
          establishmentId,
          producerId: dto.producerId,
          number,
          activity: dto.activity ?? 'Apicola',
          status: dto.status ?? 'PENDING_VERIFICATION',
          validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
          validTo: dto.validTo ? new Date(dto.validTo) : null,
          externalSystem: 'MANUAL',
          syncStatus: 'PENDING_SYNC',
          sourceNote: dto.sourceNote ?? 'Carga manual',
        })
        .returning();

      await this.events.publish(
        {
          eventType: DomainEvents.RenspaAssociated,
          entityType: 'establishment',
          entityId: establishmentId,
          actorUserId: actor.id,
          organizationId: target.organizationId,
          correlationId,
          payload: { renspaId: created.id, number: created.number, producerId: dto.producerId },
        },
        tx,
      );
      return created;
    });
  }

  async listRenspa(establishmentId: string, actor: AuthenticatedUser) {
    await this.findOne(establishmentId, actor);
    return this.db
      .select()
      .from(renspaRegistration)
      .where(eq(renspaRegistration.establishmentId, establishmentId))
      .orderBy(asc(renspaRegistration.createdAt));
  }

  /**
   * Destinos posibles de un traslado, de cualquier organizacion: salas de
   * extraccion y acopios activos. Resuelve el hallazgo H-02 (un productor no
   * podia elegir una sala de otra organizacion). Devuelve solo datos publicos
   * del establecimiento, nunca datos del titular.
   */
  async receivers(query: ListReceiversQueryDto) {
    const conditions: SQL[] = [
      eq(establishment.status, 'ACTIVE'),
      eq(establishment.type, query.type ?? 'SALA_EXTRACCION'),
    ];
    if (query.q) {
      const like = `%${query.q}%`;
      const search = or(
        ilike(establishment.name, like),
        ilike(establishment.locality, like),
        ilike(establishment.senasaCode, like),
      );
      if (search) conditions.push(search);
    }
    const where = and(...conditions);

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({
          id: establishment.id,
          name: establishment.name,
          type: establishment.type,
          locality: establishment.locality,
          province: establishment.province,
          senasaCode: establishment.senasaCode,
          senasaStatus: establishment.senasaStatus,
          senasaValidTo: establishment.senasaValidTo,
          organizationId: establishment.organizationId,
          organizationName: organization.name,
        })
        .from(establishment)
        .innerJoin(organization, eq(organization.id, establishment.organizationId))
        .where(where)
        .orderBy(asc(establishment.name))
        .limit(query.pageSize)
        .offset(query.offset),
      this.db.select({ count: sql<number>`cast(count(*) as int)` }).from(establishment).where(where),
    ]);
    return { rows, total: count };
  }

  /** El codigo SENASA identifica al establecimiento habilitado: no se comparte. */
  private async assertSenasaCodeAvailable(
    value: string | undefined | null,
    exceptId?: string,
  ): Promise<string | null> {
    const code = value?.trim().toUpperCase().replace(/\s+/g, '') || null;
    if (!code) return null;
    const rows = await this.db
      .select({ id: establishment.id })
      .from(establishment)
      .where(eq(establishment.senasaCode, code))
      .limit(2);
    if (rows.some((row) => row.id !== exceptId)) {
      throw new ConflictException(`El codigo SENASA ${code} ya esta asignado a otro establecimiento.`);
    }
    return code;
  }

  /** RENSPA vigente de un establecimiento, usado al armar el DT-e. */
  async activeRenspaNumber(establishmentId: string): Promise<string | null> {
    const rows = await this.db
      .select({ number: renspaRegistration.number })
      .from(renspaRegistration)
      .where(
        and(
          eq(renspaRegistration.establishmentId, establishmentId),
          inArray(renspaRegistration.status, ['ACTIVE', 'PENDING_VERIFICATION']),
        ),
      )
      .orderBy(asc(renspaRegistration.createdAt))
      .limit(1);
    return rows[0]?.number ?? null;
  }
}
