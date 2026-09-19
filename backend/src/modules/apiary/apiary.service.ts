import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { apiary, establishment, hive } from '../../database/schema';
import { AccessControlService } from '../../common/services/access-control.service';
import { DomainEvents, EventsService } from '../../common/services/events.service';
import { EstablishmentService } from '../establishment/establishment.service';
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
  ) {}

  /** CU-07. */
  async create(dto: CreateApiaryDto, actor: AuthenticatedUser, correlationId?: string) {
    this.access.assertCanWrite(actor);
    const parent = await this.establishments.findOne(dto.establishmentId, actor);
    if (parent.status !== 'ACTIVE') {
      throw new BadRequestException(
        `No se pueden registrar apiarios en un establecimiento ${parent.status}.`,
      );
    }

    const code = dto.code.trim().toUpperCase();
    const duplicate = await this.db
      .select({ id: apiary.id })
      .from(apiary)
      .where(and(eq(apiary.establishmentId, dto.establishmentId), eq(apiary.code, code)))
      .limit(1);
    if (duplicate.length > 0) {
      throw new ConflictException(`Ya existe un apiario ${code} en ese establecimiento.`);
    }

    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(apiary)
        .values({
          establishmentId: dto.establishmentId,
          code,
          name: dto.name ?? null,
          latitude: dto.latitude !== undefined ? String(dto.latitude) : null,
          longitude: dto.longitude !== undefined ? String(dto.longitude) : null,
          locality: dto.locality ?? parent.locality,
          province: dto.province ?? parent.province,
          hiveCount: dto.hiveCount ?? 0,
          registeredAt: dto.registeredAt ? new Date(dto.registeredAt) : new Date(),
          renapaCode: dto.renapaCode ?? null,
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
          payload: { code: created.code, establishmentId: parent.id },
        },
        tx,
      );
      return created;
    });
  }

  async list(
    query: PaginationQueryDto,
    actor: AuthenticatedUser,
    filters: { establishmentId?: string } = {},
  ) {
    const conditions: SQL[] = [];
    const scope = this.access.organizationScope(actor);
    if (scope) conditions.push(eq(establishment.organizationId, scope));
    if (filters.establishmentId) conditions.push(eq(apiary.establishmentId, filters.establishmentId));
    if (query.q) {
      const like = `%${query.q}%`;
      const search = or(ilike(apiary.code, like), ilike(apiary.name, like));
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
          createdAt: apiary.createdAt,
        })
        .from(apiary)
        .innerJoin(establishment, eq(apiary.establishmentId, establishment.id))
        .where(where)
        .orderBy(asc(apiary.code))
        .limit(query.pageSize)
        .offset(query.offset),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(apiary)
        .innerJoin(establishment, eq(apiary.establishmentId, establishment.id))
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
    await this.findOne(id, actor);
    const [updated] = await this.db
      .update(apiary)
      .set({
        ...dto,
        latitude: dto.latitude !== undefined ? String(dto.latitude) : undefined,
        longitude: dto.longitude !== undefined ? String(dto.longitude) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(apiary.id, id))
      .returning();
    return updated;
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
