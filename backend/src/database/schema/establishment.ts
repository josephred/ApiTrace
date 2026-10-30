import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  entityStatusEnum,
  establishmentTypeEnum,
  externalSystemEnum,
  registrationStatusEnum,
  syncStatusEnum,
} from './enums';
import { organization } from './identity';
import { mediaFile } from './media';
import { producer } from './producer';
import { zone } from './zone';

/**
 * Establecimiento / predio. Unidad territorial y operativa.
 * Regla de modelado 3: el Establecimiento no es el Apiario ni el RENSPA.
 */
export const establishment = pgTable(
  'establishment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    producerId: uuid('producer_id').references(() => producer.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 200 }).notNull(),
    type: establishmentTypeEnum('type').notNull(),
    address: varchar('address', { length: 300 }),
    locality: varchar('locality', { length: 120 }),
    province: varchar('province', { length: 100 }),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    status: entityStatusEnum('status').notNull().default('ACTIVE'),
    /** RNE: identificador SIFeGA del establecimiento alimentario (referencia externa). */
    rne: varchar('rne', { length: 60 }),
    /**
     * Codigo del establecimiento habilitado por SENASA. Para una sala de extraccion
     * es el destino del DT-e API-SEM (formato SEF-Letra-N°, ej. SEF-B-20010).
     */
    senasaCode: varchar('senasa_code', { length: 40 }),
    /** Habilitacion vigente en SENASA. SIGSA rechaza el DT-e si la sala no esta habilitada. */
    senasaStatus: registrationStatusEnum('senasa_status').notNull().default('PENDING_VERIFICATION'),
    senasaValidTo: date('senasa_valid_to', { mode: 'string' }),
    /** Foto tomada al registrarlo (media_file, migracion 0003). */
    photoId: uuid('photo_id').references(() => mediaFile.id, { onDelete: 'set null' }),
    /**
     * Zona del apicultor, la misma que agrupa sus apiarios (migracion 0004).
     * La usan las fincas de polinizacion; borrar la zona la deja «sin zona».
     */
    zoneId: uuid('zone_id').references(() => zone.id, { onDelete: 'set null' }),
    /**
     * Colmenas que el apicultor lleva a polinizar a la finca (migracion 0004).
     * Solo FINCA_POLINIZACION; en el resto de los establecimientos queda NULL.
     */
    hiveCount: integer('hive_count'),
    /**
     * RENSPA del campo de un tercero (finca de polinizacion), tal como lo
     * informa el apicultor (migracion 0004). Es opcional y no es un RENSPA
     * propio: el del productor se asocia con CU-06 en renspa_registration. No
     * es unico, porque varios apicultores pueden llevar colmenas al mismo
     * campo. El DT-e lo toma como RENSPA de destino cuando no hay uno asociado.
     */
    renspaNumber: varchar('renspa_number', { length: 60 }),
    createdById: uuid('created_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('establishment_org_status_idx').on(t.organizationId, t.status),
    index('establishment_type_status_idx').on(t.type, t.status),
    uniqueIndex('establishment_senasa_code_uq').on(t.senasaCode),
    index('establishment_photo_idx').on(t.photoId),
    index('establishment_zone_idx').on(t.zoneId),
    check('establishment_hive_count_ck', sql`${t.hiveCount} IS NULL OR ${t.hiveCount} >= 0`),
  ],
);

/**
 * RENSPA: vincula productor, actividad y establecimiento/predio.
 * Regla de modelado 2 y 3: no se fusiona con RENAPA ni con Apiario.
 */
export const renspaRegistration = pgTable(
  'renspa_registration',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    establishmentId: uuid('establishment_id')
      .notNull()
      .references(() => establishment.id, { onDelete: 'cascade' }),
    producerId: uuid('producer_id')
      .notNull()
      .references(() => producer.id, { onDelete: 'restrict' }),
    number: varchar('number', { length: 60 }).notNull().unique(),
    activity: varchar('activity', { length: 120 }),
    status: registrationStatusEnum('status').notNull().default('PENDING_VERIFICATION'),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validTo: timestamp('valid_to', { withTimezone: true }),
    externalSystem: externalSystemEnum('external_system').notNull().default('MANUAL'),
    externalId: varchar('external_id', { length: 120 }),
    syncStatus: syncStatusEnum('sync_status').notNull().default('NOT_APPLICABLE'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    sourceNote: varchar('source_note', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('renspa_establishment_status_idx').on(t.establishmentId, t.status),
    index('renspa_producer_idx').on(t.producerId),
  ],
);
