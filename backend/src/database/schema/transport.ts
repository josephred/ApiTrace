import { sql } from 'drizzle-orm';
import { check, index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { entityStatusEnum } from './enums';
import { organization } from './identity';

export const carrier = pgTable('carrier', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organization.id, {
    onDelete: 'set null',
  }),
  businessName: varchar('business_name', { length: 200 }).notNull(),
  taxId: varchar('tax_id', { length: 20 }).unique(),
  licenseNumber: varchar('license_number', { length: 80 }),
  contactName: varchar('contact_name', { length: 160 }),
  phone: varchar('phone', { length: 40 }),
  status: entityStatusEnum('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Vehiculo (maestro «Traslados» → «Nuevo transporte»).
 *
 * Hasta la migracion 0003 cada vehiculo colgaba de una empresa transportista y
 * la patente era unica en toda la plataforma. El apicultor que lleva sus alzas
 * en su propia camioneta no es una transportista: ahora el vehiculo pertenece
 * a una organizacion (la del productor, la sala…) y la transportista es
 * opcional. La misma patente puede figurar en dos organizaciones (un flete que
 * trabaja para varios apicultores), pero no dos veces en la misma.
 */
export const vehicle = pgTable(
  'vehicle',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'restrict',
    }),
    carrierId: uuid('carrier_id').references(() => carrier.id, { onDelete: 'cascade' }),
    /** Como lo reconoce quien lo usa: «Camioneta Hilux», «El Mercedes». */
    name: varchar('name', { length: 80 }),
    /** Nombre completo del conductor habitual. */
    driverName: varchar('driver_name', { length: 160 }),
    plate: varchar('plate', { length: 20 }).notNull(),
    trailerPlate: varchar('trailer_plate', { length: 20 }),
    /** CAMIONETA, CAMION, ACOPLADO, FURGON, UTILITARIO u OTRO (texto libre en datos anteriores). */
    type: varchar('type', { length: 60 }),
    status: entityStatusEnum('status').notNull().default('ACTIVE'),
    createdById: uuid('created_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('vehicle_organization_plate_uq')
      .on(t.organizationId, t.plate)
      .where(sql`${t.organizationId} IS NOT NULL`),
    uniqueIndex('vehicle_carrier_plate_uq')
      .on(t.carrierId, t.plate)
      .where(sql`${t.organizationId} IS NULL`),
    index('vehicle_carrier_idx').on(t.carrierId),
    check('vehicle_owner_ck', sql`${t.organizationId} IS NOT NULL OR ${t.carrierId} IS NOT NULL`),
  ],
);
