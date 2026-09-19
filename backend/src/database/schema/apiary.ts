import { index, integer, numeric, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { entityStatusEnum } from './enums';
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
    renapaCode: varchar('renapa_code', { length: 40 }),
    renapaStatus: varchar('renapa_status', { length: 40 }).notNull().default('PENDING_VERIFICATION'),
    renapaValidTo: varchar('renapa_valid_to', { length: 10 }),
    registeredAt: timestamp('registered_at', { withTimezone: true }),
    notes: varchar('notes', { length: 1000 }),
    createdById: uuid('created_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('apiary_establishment_code_uq').on(t.establishmentId, t.code),
    index('apiary_status_idx').on(t.status),
    index('apiary_renapa_code_idx').on(t.renapaCode),
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
