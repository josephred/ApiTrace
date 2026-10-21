import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { movement, vehicle } from '../../database/schema';
import { AccessControlService } from '../../common/services/access-control.service';
import type { AuthenticatedUser } from '../../common/types';
import { normalizePlate } from '../movement/dte.rules';
import type { CreateVehicleDto, UpdateVehicleDto, VehicleKind } from './dto/vehicle.dto';

type VehicleRow = typeof vehicle.$inferSelect;

/** Tipo de transporte del DT-e para un vehiculo del maestro. */
export const dteTransportTypeFor = (
  kind: string | null | undefined,
): 'CAMION' | 'CAMIONETA' | 'FURGON' | 'UTILITARIO' | 'OTRO' => {
  switch ((kind ?? '').toUpperCase() as VehicleKind | string) {
    case 'CAMIONETA':
      return 'CAMIONETA';
    case 'CAMION':
    case 'ACOPLADO':
      return 'CAMION';
    case 'FURGON':
      return 'FURGON';
    case 'UTILITARIO':
      return 'UTILITARIO';
    default:
      // Datos anteriores en texto libre («Camion furgon»): se interpreta lo evidente.
      if (/cami[oó]neta/i.test(kind ?? '')) return 'CAMIONETA';
      if (/furg[oó]n/i.test(kind ?? '')) return 'FURGON';
      if (/cami[oó]n|acoplado/i.test(kind ?? '')) return 'CAMION';
      return 'OTRO';
  }
};

/**
 * Maestro de transportes (Traslados → «Nuevo transporte»): conductor,
 * patente y carro. Cada organizacion administra los suyos y los elige en el
 * paso 2 del asistente del DT-e.
 */
@Injectable()
export class VehicleService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessControlService,
  ) {}

  /** Los activos primero; entre ellos, el ultimo usado arriba. */
  async list(actor: AuthenticatedUser, includeInactive = false) {
    const organizationId = this.access.organizationScope(actor);
    const lastUsed = sql<string | null>`(SELECT max(${movement.createdAt}) FROM ${movement} WHERE ${movement.vehicleId} = ${vehicle.id})`;
    const conditions = [
      organizationId ? eq(vehicle.organizationId, organizationId) : sql`${vehicle.organizationId} IS NOT NULL`,
      includeInactive ? undefined : eq(vehicle.status, 'ACTIVE'),
    ].filter(Boolean);
    return this.db
      .select({
        id: vehicle.id,
        organizationId: vehicle.organizationId,
        name: vehicle.name,
        driverName: vehicle.driverName,
        plate: vehicle.plate,
        trailerPlate: vehicle.trailerPlate,
        type: vehicle.type,
        status: vehicle.status,
        lastUsedAt: lastUsed,
        createdAt: vehicle.createdAt,
      })
      .from(vehicle)
      .where(and(...(conditions as never[])))
      .orderBy(asc(vehicle.status), desc(sql`coalesce(${lastUsed}, ${vehicle.createdAt})`), asc(vehicle.plate));
  }

  async create(dto: CreateVehicleDto, actor: AuthenticatedUser) {
    this.access.assertCanWrite(actor);
    const organizationId = this.access.requireOrganization(actor);
    const plate = normalizePlate(dto.plate);
    if (!plate) throw new ConflictException('Falta la patente del vehiculo.');
    await this.assertPlateAvailable(organizationId, plate);
    const [created] = await this.db
      .insert(vehicle)
      .values({
        organizationId,
        name: dto.name?.trim() || null,
        driverName: dto.driverName.trim().replace(/\s+/g, ' '),
        plate,
        trailerPlate: normalizePlate(dto.trailerPlate),
        type: dto.type ?? 'CAMIONETA',
        createdById: actor.id,
      })
      .returning();
    return created;
  }

  async update(id: string, dto: UpdateVehicleDto, actor: AuthenticatedUser) {
    this.access.assertCanWrite(actor);
    const current = await this.findOne(id, actor);
    const plate = dto.plate !== undefined ? normalizePlate(dto.plate) : undefined;
    if (plate && plate !== current.plate && current.organizationId) {
      await this.assertPlateAvailable(current.organizationId, plate, id);
    }
    const [updated] = await this.db
      .update(vehicle)
      .set({
        name: dto.name !== undefined ? dto.name.trim() || null : undefined,
        driverName: dto.driverName !== undefined ? dto.driverName.trim() : undefined,
        plate: plate ?? undefined,
        trailerPlate: dto.trailerPlate !== undefined ? normalizePlate(dto.trailerPlate) : undefined,
        type: dto.type,
        status: dto.status,
        updatedAt: new Date(),
      })
      .where(eq(vehicle.id, id))
      .returning();
    return updated;
  }

  /**
   * Completa un pedido de DT-e con el vehiculo guardado (paso 2 del
   * asistente): si no trae el transporte escrito a mano, el tipo, la patente,
   * el carro y el conductor salen del vehiculo.
   */
  async completeTransport<
    T extends {
      vehicleId?: string;
      transport?: { type: string; plate: string; trailerPlate?: string };
      driverName?: string;
    },
  >(dto: T, actor: AuthenticatedUser): Promise<T> {
    if (!dto.vehicleId || dto.transport) return dto;
    const saved = await this.findOne(dto.vehicleId, actor);
    return Object.assign(Object.create(Object.getPrototypeOf(dto)) as T, dto, {
      transport: {
        type: dteTransportTypeFor(saved.type),
        plate: saved.plate,
        ...(saved.trailerPlate ? { trailerPlate: saved.trailerPlate } : {}),
      },
      driverName: dto.driverName ?? saved.driverName ?? undefined,
    });
  }

  async findOne(id: string, actor: AuthenticatedUser): Promise<VehicleRow> {
    const rows = await this.db.select().from(vehicle).where(eq(vehicle.id, id)).limit(1);
    if (rows.length === 0) throw new NotFoundException('Vehiculo no encontrado.');
    this.access.assertOrganizationAccess(actor, rows[0].organizationId);
    return rows[0];
  }

  private async assertPlateAvailable(organizationId: string, plate: string, exceptId?: string) {
    const rows = await this.db
      .select({ id: vehicle.id, status: vehicle.status })
      .from(vehicle)
      .where(
        and(
          eq(vehicle.organizationId, organizationId),
          eq(vehicle.plate, plate),
          exceptId ? ne(vehicle.id, exceptId) : undefined,
        ),
      )
      .limit(1);
    if (rows.length > 0) {
      throw new ConflictException(
        rows[0].status === 'ACTIVE'
          ? `Ya tenes un vehiculo con la patente ${plate}.`
          : `La patente ${plate} es de un vehiculo dado de baja: reactivalo desde Traslados.`,
      );
    }
  }
}
