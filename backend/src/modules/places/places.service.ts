import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { apiary, establishment, organization, zone } from '../../database/schema';
import { AccessControlService } from '../../common/services/access-control.service';
import type { AuthenticatedUser } from '../../common/types';
import {
  PLACE_ESTABLISHMENT_TYPES,
  PLACE_TYPES,
  placeTypeOfEstablishment,
  type PlaceType,
} from '../movement/cargo';

/** Destinos que cualquier organizacion puede elegir (como GET /establishments/receivers). */
const PUBLIC_DESTINATION_TYPES = ['SALA_EXTRACCION', 'FRACCIONADORA', 'ACOPIO'] as const;

export interface PlaceItem {
  id: string;
  kind: 'apiary' | 'establishment';
  placeType: PlaceType;
  establishmentType: string;
  name: string;
  /** RENAPA del apiario, codigo SENASA o RNE de la sala. */
  code: string | null;
  codeLabel: string | null;
  /** Codigo interno (API-001) cuando el apiario no tiene RENAPA. */
  internalCode: string | null;
  locality: string | null;
  province: string | null;
  zoneId: string | null;
  zoneName: string | null;
  hiveCount: number | null;
  organizationId: string;
  organizationName: string | null;
  own: boolean;
  status: string;
  registryStatus: string | null;
  latitude: number | null;
  longitude: number | null;
  photoId: string | null;
  warning: string | null;
}

const toCoordinate = (value: string | null): number | null =>
  value === null || value === undefined ? null : Number(value);

/**
 * Lugares del asistente del DT-e (pasos 4 y 5) y del mapa.
 *
 * Un lugar es un apiario o un establecimiento (finca, deposito, sala). Las
 * salas de extraccion y de fraccionamiento y los acopios activos son destinos
 * publicos: cualquier apicultor puede elegirlos, como en GET
 * /establishments/receivers. Todo lo demas es de la propia organizacion.
 */
@Injectable()
export class PlacesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessControlService,
  ) {}

  async list(
    input: { side: 'origin' | 'destination'; type: PlaceType; q?: string },
    actor: AuthenticatedUser,
  ): Promise<PlaceItem[]> {
    const scope = this.access.organizationScope(actor);
    if (input.type === 'APIARIO') {
      return this.apiaries(scope, actor, input.q);
    }
    const types = PLACE_ESTABLISHMENT_TYPES[input.type];
    const publicTypes =
      input.side === 'destination'
        ? types.filter((type) => (PUBLIC_DESTINATION_TYPES as readonly string[]).includes(type))
        : [];
    return this.establishments(scope, actor, { types, publicTypes, q: input.q });
  }

  /** Todo lo que tiene ubicacion, para el mapa; y cuantos lugares propios no la tienen. */
  async map(actor: AuthenticatedUser) {
    const scope = this.access.organizationScope(actor);
    const [ownApiaries, places] = await Promise.all([
      this.apiaries(scope, actor),
      this.establishments(scope, actor, {
        types: PLACE_TYPES.filter((type) => type !== 'APIARIO').flatMap(
          (type) => PLACE_ESTABLISHMENT_TYPES[type],
        ),
        publicTypes: [...PUBLIC_DESTINATION_TYPES],
      }),
    ]);
    const all = [...ownApiaries, ...places];
    const located = all.filter((item) => item.latitude !== null && item.longitude !== null);
    const withoutLocation = all.filter((item) => item.own && (item.latitude === null || item.longitude === null));
    return {
      places: located,
      withoutLocation: withoutLocation.map((item) => ({
        id: item.id,
        kind: item.kind,
        placeType: item.placeType,
        name: item.name,
      })),
      counts: PLACE_TYPES.reduce<Record<string, number>>((acc, type) => {
        acc[type] = located.filter((item) => item.placeType === type).length;
        return acc;
      }, {}),
    };
  }

  private async apiaries(scope: string | null, actor: AuthenticatedUser, q?: string): Promise<PlaceItem[]> {
    const conditions: SQL[] = [eq(apiary.status, 'ACTIVE')];
    if (scope) conditions.push(eq(establishment.organizationId, scope));
    if (q) {
      const like = `%${q}%`;
      const search = or(
        ilike(apiary.name, like),
        ilike(apiary.code, like),
        ilike(apiary.renapaCode, like),
        ilike(zone.name, like),
      );
      if (search) conditions.push(search);
    }
    const rows = await this.db
      .select({
        id: apiary.id,
        name: apiary.name,
        code: apiary.code,
        renapaCode: apiary.renapaCode,
        renapaStatus: apiary.renapaStatus,
        locality: apiary.locality,
        province: apiary.province,
        hiveCount: apiary.hiveCount,
        status: apiary.status,
        latitude: apiary.latitude,
        longitude: apiary.longitude,
        photoId: apiary.photoId,
        zoneId: apiary.zoneId,
        zoneName: zone.name,
        organizationId: establishment.organizationId,
        organizationName: organization.name,
      })
      .from(apiary)
      .innerJoin(establishment, eq(apiary.establishmentId, establishment.id))
      .innerJoin(organization, eq(organization.id, establishment.organizationId))
      .leftJoin(zone, eq(apiary.zoneId, zone.id))
      .where(and(...conditions))
      .orderBy(asc(sql`coalesce(${apiary.name}, ${apiary.code})`))
      .limit(500);

    return rows.map((row) => ({
      id: row.id,
      kind: 'apiary' as const,
      placeType: 'APIARIO' as const,
      establishmentType: 'APIARIO_BASE',
      name: row.name ?? row.code,
      code: row.renapaCode ?? row.code,
      codeLabel: row.renapaCode ? 'RENAPA' : 'Codigo',
      internalCode: row.code,
      locality: row.locality,
      province: row.province,
      zoneId: row.zoneId,
      zoneName: row.zoneName,
      hiveCount: row.hiveCount,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      own: row.organizationId === actor.organizationId,
      status: row.status,
      registryStatus: row.renapaCode ? row.renapaStatus : null,
      latitude: toCoordinate(row.latitude),
      longitude: toCoordinate(row.longitude),
      photoId: row.photoId,
      warning: row.renapaCode ? null : 'Sin codigo RENAPA',
    }));
  }

  private async establishments(
    scope: string | null,
    actor: AuthenticatedUser,
    filter: { types: readonly string[]; publicTypes: readonly string[]; q?: string },
  ): Promise<PlaceItem[]> {
    if (filter.types.length === 0) return [];
    const conditions: SQL[] = [
      eq(establishment.status, 'ACTIVE'),
      inArray(establishment.type, [...filter.types] as never[]),
    ];
    if (scope) {
      // Lo propio, de cualquier tipo pedido; de otras organizaciones, solo los destinos publicos.
      const visible =
        filter.publicTypes.length > 0
          ? or(
              eq(establishment.organizationId, scope),
              inArray(establishment.type, [...filter.publicTypes] as never[]),
            )
          : eq(establishment.organizationId, scope);
      if (visible) conditions.push(visible);
    }
    if (filter.q) {
      const like = `%${filter.q}%`;
      const search = or(
        ilike(establishment.name, like),
        ilike(establishment.locality, like),
        ilike(establishment.senasaCode, like),
        ilike(establishment.rne, like),
      );
      if (search) conditions.push(search);
    }
    const rows = await this.db
      .select({
        id: establishment.id,
        name: establishment.name,
        type: establishment.type,
        senasaCode: establishment.senasaCode,
        senasaStatus: establishment.senasaStatus,
        rne: establishment.rne,
        locality: establishment.locality,
        province: establishment.province,
        status: establishment.status,
        latitude: establishment.latitude,
        longitude: establishment.longitude,
        photoId: establishment.photoId,
        organizationId: establishment.organizationId,
        organizationName: organization.name,
      })
      .from(establishment)
      .innerJoin(organization, eq(organization.id, establishment.organizationId))
      .where(and(...conditions, ne(establishment.type, 'APIARIO_BASE')))
      .orderBy(asc(establishment.name))
      .limit(500);

    return rows.map((row) => {
      const placeType = placeTypeOfEstablishment(row.type) ?? 'DEPOSITO';
      const code = row.senasaCode ?? row.rne;
      return {
        id: row.id,
        kind: 'establishment' as const,
        placeType,
        establishmentType: row.type,
        name: row.name,
        code,
        codeLabel: row.senasaCode ? 'Habilitacion' : row.rne ? 'RNE' : null,
        internalCode: null,
        locality: row.locality,
        province: row.province,
        zoneId: null,
        zoneName: null,
        hiveCount: null,
        organizationId: row.organizationId,
        organizationName: row.organizationName,
        own: row.organizationId === actor.organizationId,
        status: row.status,
        registryStatus: row.senasaCode ? row.senasaStatus : null,
        latitude: toCoordinate(row.latitude),
        longitude: toCoordinate(row.longitude),
        photoId: row.photoId,
        warning:
          placeType === 'SALA_EXTRACCION' && !row.senasaCode ? 'Sin codigo de habilitacion SENASA' : null,
      };
    });
  }
}
