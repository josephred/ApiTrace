import { index, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import {
  entityStatusEnum,
  externalSystemEnum,
  personTypeEnum,
  registrationStatusEnum,
  senasaDelegationStatusEnum,
  senasaServiceEnum,
  syncStatusEnum,
} from './enums';
import { organization } from './identity';

/**
 * Productor: el actor responsable de la actividad apicola.
 * Regla de modelado 1 (mapa del dominio, seccion 7): el Productor NO es el RENAPA.
 */
export const producer = pgTable(
  'producer',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    businessName: varchar('business_name', { length: 200 }).notNull(),
    personType: personTypeEnum('person_type').notNull().default('FISICA'),
    taxId: varchar('tax_id', { length: 20 }).unique(),
    status: entityStatusEnum('status').notNull().default('ACTIVE'),
    email: varchar('email', { length: 180 }),
    phone: varchar('phone', { length: 40 }),
    address: varchar('address', { length: 300 }),
    province: varchar('province', { length: 100 }),
    locality: varchar('locality', { length: 120 }),
    notes: varchar('notes', { length: 1000 }),
    createdById: uuid('created_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('producer_org_status_idx').on(t.organizationId, t.status)],
);

/**
 * RENAPA: registro de la actividad apicola del productor.
 * Entidad separada por regla de modelado 1 y 2. El numero oficial nunca es PK.
 */
export const renapaRegistration = pgTable(
  'renapa_registration',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    producerId: uuid('producer_id')
      .notNull()
      .references(() => producer.id, { onDelete: 'cascade' }),
    number: varchar('number', { length: 60 }).notNull().unique(),
    status: registrationStatusEnum('status').notNull().default('PENDING_VERIFICATION'),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    externalSystem: externalSystemEnum('external_system').notNull().default('MANUAL'),
    externalId: varchar('external_id', { length: 120 }),
    syncStatus: syncStatusEnum('sync_status').notNull().default('NOT_APPLICABLE'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    sourceNote: varchar('source_note', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('renapa_producer_status_idx').on(t.producerId, t.status)],
);

/**
 * Delegacion de un servicio de SENASA en ApiTrace (especificacion DT-e, 3.3).
 *
 * Para emitir o cerrar DT-e en nombre del titular, este debe delegar el servicio
 * (SIGSA para emitir, SITA para cerrar en sala) a la CUIT de ApiTrace desde el
 * Administrador de Relaciones de ARCA (formulario F3283/E). La plataforma solo
 * registra el estado: la delegacion ocurre en ARCA y no se puede crear desde aca.
 */
export const senasaDelegation = pgTable(
  'senasa_delegation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    producerId: uuid('producer_id')
      .notNull()
      .references(() => producer.id, { onDelete: 'cascade' }),
    service: senasaServiceEnum('service').notNull(),
    status: senasaDelegationStatusEnum('status').notNull().default('NO_INICIADA'),
    /** CUIT del representante (la de ApiTrace) a la que se delego. */
    delegatedToTaxId: varchar('delegated_to_tax_id', { length: 20 }),
    /** Numero de la constancia F3283/E. */
    formNumber: varchar('form_number', { length: 60 }),
    requestedAt: timestamp('requested_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    notes: varchar('notes', { length: 600 }),
    updatedById: uuid('updated_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('senasa_delegation_producer_service_uq').on(t.producerId, t.service)],
);
