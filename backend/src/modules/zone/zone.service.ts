import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { apiary, establishment, zone } from '../../database/schema';
import { AccessControlService } from '../../common/services/access-control.service';
import type { DbExecutor } from '../../common/services/types';
import type { AuthenticatedUser } from '../../common/types';

/** «Zona norte» y «zona  norte» son la misma: se guarda con espacios simples. */
export const cleanZoneName = (value: string): string => value.trim().replace(/\s+/g, ' ');

/**
 * Zonas del apicultor para ordenar sus apiarios. Cada organizacion ve y edita
 * solo las suyas.
 */
@Injectable()
export class ZoneService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessControlService,
  ) {}

  /** Zonas con la cantidad de apiarios activos de cada una. */
  async list(actor: AuthenticatedUser, organizationId?: string) {
    const scope =
      organizationId && this.access.hasGlobalScope(actor)
        ? organizationId
        : this.access.requireOrganization(actor);
    return this.db
      .select({
        id: zone.id,
        name: zone.name,
        organizationId: zone.organizationId,
        apiaryCount: sql<number>`cast(count(${apiary.id}) as int)`,
        hiveCount: sql<number>`cast(coalesce(sum(${apiary.hiveCount}), 0) as int)`,
        createdAt: zone.createdAt,
      })
      .from(zone)
      .leftJoin(apiary, and(eq(apiary.zoneId, zone.id), eq(apiary.status, 'ACTIVE')))
      .where(eq(zone.organizationId, scope))
      .groupBy(zone.id)
      .orderBy(asc(zone.name));
  }

  async create(name: string, actor: AuthenticatedUser) {
    this.access.assertCanWrite(actor);
    const organizationId = this.access.requireOrganization(actor);
    const clean = cleanZoneName(name);
    const existing = await this.findByName(organizationId, clean);
    if (existing) throw new ConflictException(`Ya tenes una zona llamada ${existing.name}.`);
    const [created] = await this.db
      .insert(zone)
      .values({ organizationId, name: clean, createdById: actor.id })
      .returning();
    return { ...created, apiaryCount: 0, hiveCount: 0 };
  }

  async rename(id: string, name: string, actor: AuthenticatedUser) {
    this.access.assertCanWrite(actor);
    const current = await this.findOne(id, actor);
    const clean = cleanZoneName(name);
    const existing = await this.findByName(current.organizationId, clean);
    if (existing && existing.id !== id) {
      throw new ConflictException(`Ya tenes una zona llamada ${existing.name}.`);
    }
    const [updated] = await this.db
      .update(zone)
      .set({ name: clean, updatedAt: new Date() })
      .where(eq(zone.id, id))
      .returning();
    return updated;
  }

  /** Borrar una zona no borra apiarios: quedan «sin zona». */
  async remove(id: string, actor: AuthenticatedUser) {
    this.access.assertCanWrite(actor);
    await this.findOne(id, actor);
    await this.db.transaction(async (tx) => {
      await tx.update(apiary).set({ zoneId: null, updatedAt: new Date() }).where(eq(apiary.zoneId, id));
      await tx.delete(zone).where(eq(zone.id, id));
    });
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const rows = await this.db.select().from(zone).where(eq(zone.id, id)).limit(1);
    if (rows.length === 0) throw new NotFoundException('Zona no encontrada.');
    this.access.assertOrganizationAccess(actor, rows[0].organizationId);
    return rows[0];
  }

  /**
   * Zona para un apiario: la existente con ese nombre, o una nueva. Permite
   * crearla desde el mismo formulario del apiario, sin ir a otra pantalla.
   */
  async resolveForApiary(
    input: { zoneId?: string | null; zoneName?: string | null },
    apiaryEstablishmentId: string,
    actor: AuthenticatedUser,
    executor: DbExecutor = this.db,
  ): Promise<string | null | undefined> {
    if (input.zoneId === null) return null;
    const owner = await executor
      .select({ organizationId: establishment.organizationId })
      .from(establishment)
      .where(eq(establishment.id, apiaryEstablishmentId))
      .limit(1);
    const organizationId = owner[0]?.organizationId;
    if (!organizationId) throw new NotFoundException('Establecimiento no encontrado.');

    if (input.zoneId) {
      const found = await this.findOne(input.zoneId, actor);
      if (found.organizationId !== organizationId) {
        throw new ConflictException('La zona es de otra organizacion que el apiario.');
      }
      return found.id;
    }
    if (input.zoneName && cleanZoneName(input.zoneName)) {
      const clean = cleanZoneName(input.zoneName);
      const existing = await this.findByName(organizationId, clean, executor);
      if (existing) return existing.id;
      const [created] = await executor
        .insert(zone)
        .values({ organizationId, name: clean, createdById: actor.id })
        .returning({ id: zone.id });
      return created.id;
    }
    return undefined;
  }

  private async findByName(organizationId: string, name: string, executor: DbExecutor = this.db) {
    const rows = await executor
      .select()
      .from(zone)
      .where(and(eq(zone.organizationId, organizationId), sql`lower(${zone.name}) = lower(${name})`))
      .limit(1);
    return rows[0] ?? null;
  }
}
