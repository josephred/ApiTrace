import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organization } from './identity';

/** bytea de PostgreSQL: node-postgres lo entrega y lo recibe como Buffer. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

/** Tope de una foto ya comprimida en el telefono (la app la reduce a ~1280 px). */
export const MEDIA_MAX_BYTES = 3 * 1024 * 1024;

/**
 * Fotos de los maestros (apiario, sala, transporte).
 *
 * Viven en la base y no en un bucket a proposito: el MVP corre en Render + Neon
 * sin almacenamiento de objetos, y una foto comprimida en el telefono pesa
 * entre 100 y 300 KB. La miniatura se genera en el cliente para que los
 * listados no descarguen la foto completa. Si el volumen crece, la tabla se
 * reemplaza por un bucket sin tocar a quienes la referencian (photo_id).
 */
export const mediaFile = pgTable(
  'media_file',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'restrict',
    }),
    /** Que entidad la usa: apiary, establishment, vehicle. Orienta la limpieza. */
    entityType: varchar('entity_type', { length: 40 }).notNull(),
    contentType: varchar('content_type', { length: 60 }).notNull(),
    data: bytea('data').notNull(),
    thumbnail: bytea('thumbnail'),
    byteSize: integer('byte_size').notNull(),
    width: integer('width'),
    height: integer('height'),
    createdById: uuid('created_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('media_file_organization_idx').on(t.organizationId),
    check('media_file_size_ck', sql`${t.byteSize} > 0 AND ${t.byteSize} <= 3145728`),
    check('media_file_content_type_ck', sql`${t.contentType} IN ('image/jpeg', 'image/png', 'image/webp')`),
  ],
);
