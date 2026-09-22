import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import {
  documentTypeEnum,
  dteHistorySourceEnum,
  dteIssueModeEnum,
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
import { organization } from './identity';
import { producer } from './producer';
import { carrier, vehicle } from './transport';

/**
 * Reglas de negocio configurables y versionadas (arquitectura, secciones 71-72).
 * Evita hardcodear la normativa: la vigencia se expresa con effectiveFrom/effectiveTo.
 * Ejemplo real: DT-e obligatorio para material melario apiario -> sala desde 2026-08-01.
 */
export const movementRule = pgTable(
  'movement_rule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    movementType: movementTypeEnum('movement_type'),
    materialType: materialTypeEnum('material_type'),
    originType: establishmentTypeEnum('origin_type'),
    destinationType: establishmentTypeEnum('destination_type'),
    requiresDocument: boolean('requires_document').notNull().default(false),
    requiredDocumentType: documentTypeEnum('required_document_type'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    priority: integer('priority').notNull().default(100),
    active: boolean('active').notNull().default(true),
    legalReference: varchar('legal_reference', { length: 300 }),
    notes: varchar('notes', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('movement_rule_vigencia_idx').on(t.active, t.effectiveFrom, t.effectiveTo)],
);

/**
 * Movimiento: evento de dominio que conecta un origen y un destino.
 * Regla de modelado 4: el Movimiento NO es el DT-e. El DT-e es un documento asociado.
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
 *
 * Regla de modelado 4: el DT-e no es el movimiento. Un movimiento puede tener
 * varios DT-e a lo largo de su vida (el primero anulado por exceso de carga y
 * uno nuevo emitido con la cantidad corregida, especificacion 5.2), pero uno solo
 * "en juego" a la vez: lo garantiza el indice unico parcial.
 *
 * Los campos API-SEM (especificacion 4.1) son nulos en los documentos genericos
 * (p. ej. un remito registrado por la misma via): `movement_type_code` los distingue.
 */
export const dte = pgTable(
  'dte',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    movementId: uuid('movement_id')
      .notNull()
      .references(() => movement.id, { onDelete: 'cascade' }),
    number: varchar('number', { length: 80 }),
    status: dteStatusEnum('status').notNull().default('BORRADOR'),
    issueMode: dteIssueModeEnum('issue_mode').notNull().default('MANUAL'),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    originRenspa: varchar('origin_renspa', { length: 60 }),
    destinationRenspa: varchar('destination_renspa', { length: 60 }),

    // ---------------------------------------------------- titularidad (por usuario)
    /** Organizacion que emite (duena del origen). Desnormalizada para listar por usuario. */
    issuerOrganizationId: uuid('issuer_organization_id').references(() => organization.id, {
      onDelete: 'set null',
    }),
    /** Organizacion que recibe y cierra (duena del destino). */
    destinationOrganizationId: uuid('destination_organization_id').references(
      () => organization.id,
      { onDelete: 'set null' },
    ),
    /** Titular del apiario: el DT-e se emite a su nombre y su CUIT. */
    holderProducerId: uuid('holder_producer_id').references(() => producer.id, {
      onDelete: 'set null',
    }),
    holderTaxId: varchar('holder_tax_id', { length: 20 }),
    requestedById: uuid('requested_by_id'),

    // ------------------------------------------------------- tramite API-SEM (4.1)
    movementTypeCode: varchar('movement_type_code', { length: 20 }),
    transitReason: varchar('transit_reason', { length: 80 }),
    productCode: varchar('product_code', { length: 20 }),
    productName: varchar('product_name', { length: 80 }),
    unit: varchar('unit', { length: 20 }),
    /** Lo que el apicultor cree que va a cosechar. Orienta la sobreestimacion. */
    estimatedQuantity: integer('estimated_quantity'),
    /** Q declarada: tope que la sala puede confirmar (Qreal <= Qdeclarada). */
    declaredQuantity: integer('declared_quantity'),
    /** Q real confirmada por la sala al cerrar (SITA). */
    confirmedQuantity: integer('confirmed_quantity'),
    /** Fecha de carga: el DT-e es VIGENTE desde las 00:00 de este dia (hora argentina). */
    loadDate: date('load_date', { mode: 'string' }),
    /** Fecha de vencimiento: VIGENTE hasta las 23:59 de este dia; carga + 2 a 4 dias. */
    expiryDate: date('expiry_date', { mode: 'string' }),
    /** Origen oficial: RENAPA del apiario (ej. B53999-2). */
    originCode: varchar('origin_code', { length: 40 }),
    /** Destino oficial: codigo de la sala (ej. SEF-B-20010). */
    destinationCode: varchar('destination_code', { length: 40 }),
    transportType: varchar('transport_type', { length: 40 }),
    transportPlate: varchar('transport_plate', { length: 15 }),
    transportTrailerPlate: varchar('transport_trailer_plate', { length: 15 }),
    /** Codigo de cierre impreso en el DT-e. Solo lo ve quien emite (ver DteService). */
    verificationCode: varchar('verification_code', { length: 20 }),
    arrivalAt: timestamp('arrival_at', { withTimezone: true }),
    requestedAt: timestamp('requested_at', { withTimezone: true }),

    // ------------------------------------------------------- anulacion y sancion
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidReason: varchar('void_reason', { length: 600 }),
    /** Arancel abonado: define si la baja es ANULADO (true) o ELIMINADO (false). */
    feePaid: boolean('fee_paid').notNull().default(false),
    /** DT-e anulado al que reemplaza (p. ej. por exceso de carga). */
    replacesDteId: uuid('replaces_dte_id').references((): AnyPgColumn => dte.id, {
      onDelete: 'set null',
    }),
    /** Un CADUCADO bloquea al titular hasta que SENASA lo regulariza. */
    regularizedAt: timestamp('regularized_at', { withTimezone: true }),
    regularizedById: uuid('regularized_by_id'),
    regularizationNote: varchar('regularization_note', { length: 600 }),
    /** Representacion grafica oficial (PDF de SIGSA), cuando exista integracion. */
    pdfUrl: varchar('pdf_url', { length: 500 }),

    // ------------------------------------------------------------ sincronizacion
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
    index('dte_status_sync_idx').on(t.status, t.syncStatus),
    index('dte_number_idx').on(t.number),
    index('dte_movement_idx').on(t.movementId),
    index('dte_issuer_org_status_idx').on(t.issuerOrganizationId, t.status),
    index('dte_destination_org_status_idx').on(t.destinationOrganizationId, t.status),
    index('dte_holder_status_idx').on(t.holderProducerId, t.status),
    index('dte_load_date_idx').on(t.loadDate),
    // Un solo DT-e en juego por movimiento; anulados, eliminados y rechazados son historia.
    uniqueIndex('dte_movement_active_uq')
      .on(t.movementId)
      .where(sql`status NOT IN ('ANULADO', 'ELIMINADO', 'RECHAZADO')`),
    // El numero oficial de un DT-e API-SEM no se repite.
    uniqueIndex('dte_api_sem_number_uq')
      .on(t.number)
      .where(sql`number IS NOT NULL AND movement_type_code = 'API-SEM'`),
  ],
);

/**
 * Historial de estados del DT-e (especificacion 8.1, tramites_estados_log).
 * Inmutable: cada transicion deja quien, cuando, por que y desde que canal.
 */
export const dteStatusHistory = pgTable(
  'dte_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dteId: uuid('dte_id')
      .notNull()
      .references(() => dte.id, { onDelete: 'cascade' }),
    fromStatus: dteStatusEnum('from_status'),
    toStatus: dteStatusEnum('to_status').notNull(),
    source: dteHistorySourceEnum('source').notNull().default('USUARIO'),
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
