import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { apiary, establishment, hive, organization, producer, zone } from '../../database/schema';
import { AccessControlService } from '../../common/services/access-control.service';
import { DomainEvents, EventsService } from '../../common/services/events.service';
import type { DbExecutor } from '../../common/services/types';
import { EstablishmentService } from '../establishment/establishment.service';
import { MediaService } from '../media/media.service';
import { ZoneService } from '../zone/zone.service';
import type { AuthenticatedUser } from '../../common/types';
import type { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type {
  CreateApiaryDto,
  CreateHiveDto,
  UpdateApiaryDto,
  UpdateHiveDto,
} from './dto/apiary.dto';

@Injectable()
export class ApiaryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessControlService,
    private readonly events: EventsService,
    private readonly establishments: EstablishmentService,
    private readonly media: MediaService,
    private readonly zones: ZoneService,
  ) {}

  /**
   * CU-07. Desde «Nuevo apiario» llegan nombre, zona, ubicacion, colmenas y
   * foto: el establecimiento y el codigo, si no vienen, los resuelve el
   * sistema (el predio de apiarios de la organizacion y el siguiente API-00N).
   */
  async create(dto: CreateApiaryDto, actor: AuthenticatedUser, correlationId?: string) {
    this.access.assertCanWrite(actor);
    const parent = dto.establishmentId
      ? await this.establishments.findOne(dto.establishmentId, actor)
      : await this.defaultEstablishment(actor, correlationId);
    if (parent.status !== 'ACTIVE') {
      throw new BadRequestException(
        `No se pueden registrar apiarios en un establecimiento ${parent.status}.`,
      );
    }

    const renapaCode = await this.assertRenapaCodeAvailable(dto.renapaCode);
    let code: string;
    if (dto.code?.trim()) {
      code = dto.code.trim().toUpperCase();
      const duplicate = await this.db
        .select({ id: apiary.id })
        .from(apiary)
        .where(and(eq(apiary.establishmentId, parent.id), eq(apiary.code, code)))
        .limit(1);
      if (duplicate.length > 0) {
        throw new ConflictException(`Ya existe un apiario ${code} en ese establecimiento.`);
      }
    } else {
      code = await this.nextCode(parent.id);
    }

    return this.db.transaction(async (tx) => {
      const zoneId = await this.zones.resolveForApiary(
        { zoneId: dto.zoneId, zoneName: dto.zoneName },
        parent.id,
        actor,
        tx,
      );
      const photoId = dto.photo
        ? await this.media.store(
            dto.photo,
            { organizationId: parent.organizationId, entityType: 'apiary', actorId: actor.id },
            tx,
          )
        : null;
      const [created] = await tx
        .insert(apiary)
        .values({
          establishmentId: parent.id,
          code,
          zoneId: zoneId ?? null,
          photoId,
          name: dto.name?.trim() || null,
          latitude: dto.latitude !== undefined ? String(dto.latitude) : null,
          longitude: dto.longitude !== undefined ? String(dto.longitude) : null,
          locality: dto.locality ?? parent.locality,
          province: dto.province ?? parent.province,
          hiveCount: dto.hiveCount ?? 0,
          registeredAt: dto.registeredAt ? new Date(dto.registeredAt) : new Date(),
          renapaCode,
          renapaStatus: dto.renapaStatus ?? 'PENDING_VERIFICATION',
          renapaValidTo: dto.renapaValidTo ?? null,
          notes: dto.notes ?? null,
          createdById: actor.id,
        })
        .returning();

      await this.events.publish(
        {
          eventType: DomainEvents.ApiaryRegistered,
          entityType: 'apiary',
          entityId: created.id,
          actorUserId: actor.id,
          organizationId: parent.organizationId,
          correlationId,
          payload: { code: created.code, establishmentId: parent.id, zoneId: created.zoneId },
        },
        tx,
      );
      return created;
    });
  }

  /**
   * Predio de apiarios de la organizacion. Quien se registro desde el telefono
   * no tiene uno: se crea al cargar su primer apiario, a su nombre.
   */
  private async defaultEstablishment(actor: AuthenticatedUser, correlationId?: string) {
    const organizationId = this.access.requireOrganization(actor);
    const found = await this.db
      .select()
      .from(establishment)
      .where(
        and(
          eq(establishment.organizationId, organizationId),
          eq(establishment.type, 'APIARIO_BASE'),
          eq(establishment.status, 'ACTIVE'),
        ),
      )
      .orderBy(asc(establishment.createdAt))
      .limit(1);
    if (found[0]) return found[0];

    const [org] = await this.db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
    const [holder] = await this.db
      .select({ id: producer.id, province: producer.province, locality: producer.locality })
      .from(producer)
      .where(eq(producer.organizationId, organizationId))
      .orderBy(asc(producer.createdAt))
      .limit(1);
    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(establishment)
        .values({
          organizationId,
          producerId: holder?.id ?? null,
          name: `Apiarios de ${org?.name ?? 'la organizacion'}`.slice(0, 200),
          type: 'APIARIO_BASE',
          province: holder?.province ?? null,
          locality: holder?.locality ?? null,
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
          payload: { name: created.name, type: created.type, automatic: true },
        },
        tx,
      );
      return created;
    });
  }

  /** Siguiente codigo libre del establecimiento: API-001, API-002… */
  private async nextCode(establishmentId: string, executor: DbExecutor = this.db): Promise<string> {
    const rows = await executor
      .select({ code: apiary.code })
      .from(apiary)
      .where(eq(apiary.establishmentId, establishmentId));
    const used = new Set(rows.map((row) => row.code));
    let next = rows.length + 1;
    let code = `API-${String(next).padStart(3, '0')}`;
    while (used.has(code)) {
      next += 1;
      code = `API-${String(next).padStart(3, '0')}`;
    }
    return code;
  }

  async list(
    query: PaginationQueryDto,
    actor: AuthenticatedUser,
    filters: { establishmentId?: string; zoneId?: string } = {},
  ) {
    const conditions: SQL[] = [];
    const scope = this.access.organizationScope(actor);
    if (scope) conditions.push(eq(establishment.organizationId, scope));
    if (filters.establishmentId) conditions.push(eq(apiary.establishmentId, filters.establishmentId));
    if (filters.zoneId) conditions.push(eq(apiary.zoneId, filters.zoneId));
    if (query.q) {
      const like = `%${query.q}%`;
      const search = or(
        ilike(apiary.code, like),
        ilike(apiary.name, like),
        ilike(apiary.renapaCode, like),
        ilike(zone.name, like),
      );
      if (search) conditions.push(search);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({
          id: apiary.id,
          establishmentId: apiary.establishmentId,
          establishmentName: establishment.name,
          code: apiary.code,
          name: apiary.name,
          latitude: apiary.latitude,
          longitude: apiary.longitude,
          locality: apiary.locality,
          province: apiary.province,
          hiveCount: apiary.hiveCount,
          status: apiary.status,
          registeredAt: apiary.registeredAt,
          renapaCode: apiary.renapaCode,
          renapaStatus: apiary.renapaStatus,
          renapaValidTo: apiary.renapaValidTo,
          zoneId: apiary.zoneId,
          zoneName: zone.name,
          photoId: apiary.photoId,
          createdAt: apiary.createdAt,
        })
        .from(apiary)
        .innerJoin(establishment, eq(apiary.establishmentId, establishment.id))
        .leftJoin(zone, eq(apiary.zoneId, zone.id))
        .where(where)
        .orderBy(asc(apiary.code))
        .limit(query.pageSize)
        .offset(query.offset),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(apiary)
        .innerJoin(establishment, eq(apiary.establishmentId, establishment.id))
        .leftJoin(zone, eq(apiary.zoneId, zone.id))
        .where(where),
    ]);
    return { rows, total: count };
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const rows = await this.db.select().from(apiary).where(eq(apiary.id, id)).limit(1);
    if (rows.length === 0) throw new NotFoundException('Apiario no encontrado.');
    const parent = await this.establishments.findRaw(rows[0].establishmentId);
    this.access.assertOrganizationAccess(actor, parent.organizationId);
    return rows[0];
  }

  async update(id: string, dto: UpdateApiaryDto, actor: AuthenticatedUser) {
    this.access.assertCanWrite(actor);
    const current = await this.findOne(id, actor);
    const renapaCode =
      dto.renapaCode !== undefined ? await this.assertRenapaCodeAvailable(dto.renapaCode, id) : undefined;
    const { zoneId: _zoneId, zoneName: _zoneName, photo, ...rest } = dto;
    return this.db.transaction(async (tx) => {
      const zoneId = await this.zones.resolveForApiary(
        { zoneId: dto.zoneId, zoneName: dto.zoneName },
        current.establishmentId,
        actor,
        tx,
      );
      const parent = await this.establishments.findRaw(current.establishmentId);
      const photoId = photo
        ? await this.media.store(
            photo,
            { organizationId: parent.organizationId, entityType: 'apiary', actorId: actor.id },
            tx,
          )
        : undefined;
      const [updated] = await tx
        .update(apiary)
        .set({
          ...rest,
          renapaCode,
          zoneId,
          photoId,
          latitude: dto.latitude !== undefined ? String(dto.latitude) : undefined,
          longitude: dto.longitude !== undefined ? String(dto.longitude) : undefined,
          updatedAt: new Date(),
        })
        .where(eq(apiary.id, id))
        .returning();
      return updated;
    });
  }

  /**
   * El RENAPA de un apiario lo identifica ante SENASA: dos apiarios no pueden
   * compartirlo. Se guarda en mayusculas y sin espacios.
   */
  private async assertRenapaCodeAvailable(
    value: string | undefined | null,
    exceptId?: string,
  ): Promise<string | null> {
    const code = value?.trim().toUpperCase().replace(/\s+/g, '') || null;
    if (!code) return null;
    const rows = await this.db
      .select({ id: apiary.id })
      .from(apiary)
      .where(eq(apiary.renapaCode, code))
      .limit(2);
    if (rows.some((row) => row.id !== exceptId)) {
      throw new ConflictException(`El RENAPA ${code} ya esta asignado a otro apiario.`);
    }
    return code;
  }

  /** CU-08. */
  async addHive(
    apiaryId: string,
    dto: CreateHiveDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ) {
    this.access.assertCanWrite(actor);
    const parent = await this.findOne(apiaryId, actor);
    const code = dto.code.trim().toUpperCase();

    const duplicate = await this.db
      .select({ id: hive.id })
      .from(hive)
      .where(and(eq(hive.apiaryId, apiaryId), eq(hive.code, code)))
      .limit(1);
    if (duplicate.length > 0) {
      throw new ConflictException(`Ya existe la colmena ${code} en ese apiario.`);
    }

    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(hive)
        .values({
          apiaryId,
          code,
          identifier: dto.identifier ?? null,
          type: dto.type ?? null,
          installedAt: dto.installedAt ? new Date(dto.installedAt) : null,
          notes: dto.notes ?? null,
        })
        .returning();

      // hive_count refleja las colmenas activas cargadas: se recalcula, no se acumula.
      await tx
        .update(apiary)
        .set({
          hiveCount: sql`(SELECT count(*)::int FROM hive WHERE apiary_id = ${apiaryId} AND status = 'ACTIVE')`,
          updatedAt: new Date(),
        })
        .where(eq(apiary.id, apiaryId));

      await this.events.publish(
        {
          eventType: DomainEvents.HiveRegistered,
          entityType: 'apiary',
          entityId: apiaryId,
          actorUserId: actor.id,
          correlationId,
          payload: { hiveId: created.id, code: created.code, apiaryCode: parent.code },
        },
        tx,
      );
      return created;
    });
  }

  async listHives(apiaryId: string, actor: AuthenticatedUser) {
    await this.findOne(apiaryId, actor);
    return this.db.select().from(hive).where(eq(hive.apiaryId, apiaryId)).orderBy(asc(hive.code));
  }

  async updateHive(
    apiaryId: string,
    hiveId: string,
    dto: UpdateHiveDto,
    actor: AuthenticatedUser,
  ) {
    this.access.assertCanWrite(actor);
    await this.findOne(apiaryId, actor);
    const rows = await this.db
      .select()
      .from(hive)
      .where(and(eq(hive.id, hiveId), eq(hive.apiaryId, apiaryId)))
      .limit(1);
    if (rows.length === 0) throw new NotFoundException('Colmena no encontrada en ese apiario.');

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(hive)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(hive.id, hiveId))
        .returning();

      await tx
        .update(apiary)
        .set({
          hiveCount: sql`(SELECT count(*)::int FROM hive WHERE apiary_id = ${apiaryId} AND status = 'ACTIVE')`,
          updatedAt: new Date(),
        })
        .where(eq(apiary.id, apiaryId));

      return updated;
    });
  }
}
