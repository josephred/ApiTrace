import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { entityStatusEnum, registrationStatusEnum } from './enums';
import { establishment } from './establishment';

/** Apiario: unidad productiva que contiene colmenas, dentro de un establecimiento. */
export const apiary = pgTable(
  'apiary',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    establishmentId: uuid('establishment_id')
      .notNull()
      .references(() => establishment.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 60 }).notNull(),
    name: varchar('name', { length: 160 }),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    locality: varchar('locality', { length: 120 }),
    province: varchar('province', { length: 100 }),
    hiveCount: integer('hive_count').notNull().default(0),
    status: entityStatusEnum('status').notNull().default('ACTIVE'),
    registeredAt: timestamp('registered_at', { withTimezone: true }),
    /**
     * Identificacion oficial del apiario en RENAPA, formato Letra-N°RENAPA-N°Apiario
     * (ej. B53999-2). Es el "establecimiento de origen" del DT-e API-SEM. Nunca PK:
     * `code` sigue siendo el codigo interno del productor.
     */
    renapaCode: varchar('renapa_code', { length: 40 }),
    /** Habilitacion del apiario en RENAPA. SIGSA no emite DT-e si no esta ACTIVE. */
    renapaStatus: registrationStatusEnum('renapa_status').notNull().default('PENDING_VERIFICATION'),
    renapaValidTo: date('renapa_valid_to', { mode: 'string' }),
    notes: varchar('notes', { length: 1000 }),
    createdById: uuid('created_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('apiary_establishment_code_uq').on(t.establishmentId, t.code),
    index('apiary_status_idx').on(t.status),
    uniqueIndex('apiary_renapa_code_uq').on(t.renapaCode),
  ],
);

export const hive = pgTable(
  'hive',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apiaryId: uuid('apiary_id')
      .notNull()
      .references(() => apiary.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 60 }).notNull(),
    identifier: varchar('identifier', { length: 120 }),
    type: varchar('type', { length: 60 }),
    status: entityStatusEnum('status').notNull().default('ACTIVE'),
    installedAt: timestamp('installed_at', { withTimezone: true }),
    notes: varchar('notes', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('hive_apiary_code_uq').on(t.apiaryId, t.code)],
);
