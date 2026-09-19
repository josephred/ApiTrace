import { index, numeric, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import {
  entityStatusEnum,
  establishmentTypeEnum,
  externalSystemEnum,
  registrationStatusEnum,
  syncStatusEnum,
} from './enums';
import { organization } from './identity';
import { producer } from './producer';

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
    senasaCode: varchar('senasa_code', { length: 40 }),
    senasaStatus: varchar('senasa_status', { length: 40 }).notNull().default('PENDING_VERIFICATION'),
    senasaValidTo: varchar('senasa_valid_to', { length: 10 }),
    /** RNE: identificador SIFeGA del establecimiento alimentario (referencia externa). */
    rne: varchar('rne', { length: 60 }),
    createdById: uuid('created_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('establishment_org_status_idx').on(t.organizationId, t.status),
    index('establishment_type_status_idx').on(t.type, t.status),
    index('establishment_senasa_code_idx').on(t.senasaCode),
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
