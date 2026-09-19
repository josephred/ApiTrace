import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  documentTypeEnum,
  dteStatusEnum,
  establishmentTypeEnum,
  externalSystemEnum,
  materialTypeEnum,
  movementStatusEnum,
  movementTypeEnum,
  receptionResultEnum,
  syncStatusEnum,
  unitOfMeasureEnum,
} from './enums';
import { establishment } from './establishment';
import { apiary } from './apiary';
import { carrier, vehicle } from './transport';
import { organization } from './identity';
import { producer } from './producer';

/**
 * Reglas de negocio configurables y versionadas (arquitectura, secciones 71-72).
 * Evita hardcodear la normativa: la vigencia se expresa con effectiveFrom/effectiveTo.
 */
export const movementRule = pgTable(
  'movement_rule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 160 }).notNull(),
    description: varchar('description', { length: 600 }),
    sourceEstablishmentType: establishmentTypeEnum('source_establishment_type'),
    destinationEstablishmentType: establishmentTypeEnum('destination_establishment_type'),
    movementType: movementTypeEnum('movement_type'),
    materialType: materialTypeEnum('material_type'),
    requiresDocument: boolean('requires_document').notNull().default(false),
    requiredDocumentType: documentTypeEnum('required_document_type'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    priority: integer('priority').notNull().default(100),
    active: boolean('active').notNull().default(true),
    legalBasis: varchar('legal_basis', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('movement_rule_match_idx').on(
      t.active,
      t.movementType,
      t.sourceEstablishmentType,
      t.destinationEstablishmentType,
      t.priority,
    ),
  ],
);

/**
 * Movimiento / traslado. Entidad troncal de trazabilidad (CU-09).
 * Unico elemento del modelo que genera aristas en el grafo de trazabilidad.
 */
export const movement = pgTable(
  'movement',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 40 }).notNull().unique(),
    movementType: movementTypeEnum('movement_type').notNull(),
    materialType: materialTypeEnum('material_type').notNull(),
    originEstablishmentId: uuid('origin_establishment_id')
      .notNull()
      .references(() => establishment.id, { onDelete: 'restrict' }),
    originApiaryId: uuid('origin_apiary_id').references(() => apiary.id, { onDelete: 'set null' }),
    destinationEstablishmentId: uuid('destination_establishment_id')
      .notNull()
      .references(() => establishment.id, { onDelete: 'restrict' }),
    carrierId: uuid('carrier_id').references(() => carrier.id, { onDelete: 'set null' }),
    vehicleId: uuid('vehicle_id').references(() => vehicle.id, { onDelete: 'set null' }),
    driverName: varchar('driver_name', { length: 160 }),
    driverDocument: varchar('driver_document', { length: 40 }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    unit: unitOfMeasureEnum('unit').notNull(),
    status: movementStatusEnum('status').notNull().default('DRAFT'),
    requiresDocument: boolean('requires_document').notNull().default(false),
    requiredDocumentType: documentTypeEnum('required_document_type'),
    appliedRuleId: uuid('applied_rule_id').references(() => movementRule.id, {
      onDelete: 'set null',
    }),
    notes: varchar('notes', { length: 1000 }),
    createdById: uuid('created_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('movement_status_scheduled_idx').on(t.status, t.scheduledAt),
    index('movement_origin_idx').on(t.originEstablishmentId),
    index('movement_destination_idx').on(t.destinationEstablishmentId),
    index('movement_origin_apiary_idx').on(t.originApiaryId),
  ],
);

/**
 * DT-e: documento oficial que ampara determinados movimientos, gestionado en SIGSA.
 * Mantiene el par estado interno / estado externo y el estado de sincronizacion,
 * de modo que la plataforma funcione aunque el organismo no responda.
 */
export const dte = pgTable(
  'dte',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    movementId: uuid('movement_id')
      .notNull()
      .references(() => movement.id, { onDelete: 'cascade' }),
    number: varchar('number', { length: 80 }),
    status: varchar('status', { length: 40 }).notNull().default('BORRADOR'),
    issueMode: varchar('issue_mode', { length: 30 }).notNull().default('MANUAL'),
    movementTypeCode: varchar('movement_type_code', { length: 30 }).default('API-SEM'),
    transitReason: varchar('transit_reason', { length: 80 }),
    productCode: varchar('product_code', { length: 40 }),
    productName: varchar('product_name', { length: 120 }),
    unit: varchar('unit', { length: 20 }),
    issuerOrganizationId: uuid('issuer_organization_id').references(() => organization.id, {
      onDelete: 'set null',
    }),
    destinationOrganizationId: uuid('destination_organization_id').references(
      () => organization.id,
      { onDelete: 'set null' },
    ),
    holderProducerId: uuid('holder_producer_id').references(() => producer.id, {
      onDelete: 'set null',
    }),
    holderTaxId: varchar('holder_tax_id', { length: 20 }),
    originCode: varchar('origin_code', { length: 60 }),
    destinationCode: varchar('destination_code', { length: 60 }),
    estimatedQuantity: integer('estimated_quantity'),
    declaredQuantity: integer('declared_quantity'),
    confirmedQuantity: integer('confirmed_quantity'),
    loadDate: varchar('load_date', { length: 10 }),
    expiryDate: varchar('expiry_date', { length: 10 }),
    arrivalAt: timestamp('arrival_at', { withTimezone: true }),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    requestedAt: timestamp('requested_at', { withTimezone: true }),
    requestedById: uuid('requested_by_id'),
    verificationCode: varchar('verification_code', { length: 40 }),
    pdfUrl: varchar('pdf_url', { length: 500 }),
    transportType: varchar('transport_type', { length: 40 }),
    transportPlate: varchar('transport_plate', { length: 20 }),
    transportTrailerPlate: varchar('transport_trailer_plate', { length: 20 }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: varchar('void_reason', { length: 600 }),
    feePaid: boolean('fee_paid').default(false),
    regularizedAt: timestamp('regularized_at', { withTimezone: true }),
    regularizedById: uuid('regularized_by_id'),
    regularizationNote: varchar('regularization_note', { length: 600 }),
    originRenspa: varchar('origin_renspa', { length: 60 }),
    destinationRenspa: varchar('destination_renspa', { length: 60 }),
    externalSystem: externalSystemEnum('external_system').notNull().default('SENASA_SIGSA'),
    externalId: varchar('external_id', { length: 120 }),
    externalStatus: varchar('external_status', { length: 80 }),
    syncStatus: syncStatusEnum('sync_status').notNull().default('PENDING_SYNC'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    errorCode: varchar('error_code', { length: 80 }),
    errorMessage: varchar('error_message', { length: 600 }),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('dte_movement_idx').on(t.movementId),
    index('dte_status_sync_idx').on(t.status, t.syncStatus),
    index('dte_number_idx').on(t.number),
    index('dte_issuer_org_idx').on(t.issuerOrganizationId),
    index('dte_destination_org_idx').on(t.destinationOrganizationId),
    index('dte_load_date_idx').on(t.loadDate),
  ],
);

export const dteStatusHistory = pgTable(
  'dte_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dteId: uuid('dte_id')
      .notNull()
      .references(() => dte.id, { onDelete: 'cascade' }),
    fromStatus: varchar('from_status', { length: 40 }),
    toStatus: varchar('to_status', { length: 40 }).notNull(),
    source: varchar('source', { length: 30 }).notNull().default('USUARIO'),
    reason: varchar('reason', { length: 600 }),
    actorUserId: uuid('actor_user_id'),
    correlationId: varchar('correlation_id', { length: 80 }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('dte_status_history_dte_idx').on(t.dteId, t.occurredAt)],
);

export const reception = pgTable(
  'reception',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    movementId: uuid('movement_id')
      .notNull()
      .unique()
      .references(() => movement.id, { onDelete: 'cascade' }),
    establishmentId: uuid('establishment_id')
      .notNull()
      .references(() => establishment.id, { onDelete: 'restrict' }),
    receivedByUserId: uuid('received_by_user_id'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    receivedQuantity: numeric('received_quantity', { precision: 14, scale: 3 }).notNull(),
    unit: unitOfMeasureEnum('unit').notNull(),
    result: receptionResultEnum('result').notNull().default('ACCEPTED'),
    hasDiscrepancy: boolean('has_discrepancy').notNull().default(false),
    discrepancyNotes: varchar('discrepancy_notes', { length: 1000 }),
    notes: varchar('notes', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('reception_establishment_idx').on(t.establishmentId, t.receivedAt)],
);
