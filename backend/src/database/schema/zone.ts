import { sql } from 'drizzle-orm';
import { pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { organization } from './identity';

/**
 * Zona: agrupacion propia del apicultor para ordenar sus apiarios («Cargá tus
 * 45 apiarios por zona»). No es un registro oficial ni reemplaza al
 * establecimiento o al RENSPA: es como cada productor reparte su trabajo
 * (Valle de Uco, Zona Norte, la ruta 40…). Cada organizacion tiene las suyas.
 */
export const zone = pgTable(
  'zone',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 120 }).notNull(),
    createdById: uuid('created_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // «Norte» y «norte» son la misma zona para quien la escribe.
    uniqueIndex('zone_organization_name_uq').on(t.organizationId, sql`lower(${t.name})`),
  ],
);
