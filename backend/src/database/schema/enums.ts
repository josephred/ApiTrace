import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'ADMIN',
  'PRODUCTOR',
  'SALA',
  'TRANSPORTISTA',
  'ACOPIADOR',
  'FRACCIONADOR',
  'LABORATORIO',
  'EXPORTADOR',
  'AUDITOR',
  'CONSULTA',
]);

export const userStatusEnum = pgEnum('user_status', ['PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED']);

export const organizationTypeEnum = pgEnum('organization_type', [
  'PRODUCTOR',
  'SALA_EXTRACCION',
  'ACOPIO',
  'FRACCIONADOR',
  'LABORATORIO',
  'TRANSPORTE',
  'EXPORTADOR',
  'ADMINISTRACION',
]);

export const personTypeEnum = pgEnum('person_type', ['FISICA', 'JURIDICA']);

export const entityStatusEnum = pgEnum('entity_status', ['ACTIVE', 'INACTIVE', 'SUSPENDED']);

/** Estado de un registro oficial externo (RENAPA / RENSPA). */
export const registrationStatusEnum = pgEnum('registration_status', [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'EXPIRED',
  'CANCELLED',
]);

export const establishmentTypeEnum = pgEnum('establishment_type', [
  'APIARIO_BASE',
  'SALA_EXTRACCION',
  'ACOPIO',
  'FRACCIONADORA',
  'DEPOSITO',
  'LABORATORIO',
  'OTRO',
]);

export const movementTypeEnum = pgEnum('movement_type', [
  'MATERIAL_MELARIO',
  'MIEL_A_GRANEL',
  'PRODUCTO_FRACCIONADO',
  'MATERIAL_VIVO',
  'MATERIAL_INERTE',
  'OTRO',
]);

export const materialTypeEnum = pgEnum('material_type', [
  'MATERIAL_MELARIO',
  'MIEL',
  'CERA',
  'POLEN',
  'PROPOLEO',
  'JALEA_REAL',
  'NUCLEO',
  'COLMENA',
  'OTRO',
]);

export const unitOfMeasureEnum = pgEnum('unit_of_measure', [
  'KG',
  'LITRO',
  'ALZA',
  'TAMBOR',
  'COLMENA',
  'UNIDAD',
]);

export const movementStatusEnum = pgEnum('movement_status', [
  'DRAFT',
  'DISPATCHED',
  'IN_TRANSIT',
  'RECEIVED',
  'PARTIALLY_RECEIVED',
  'REJECTED',
  'CANCELLED',
]);

export const receptionResultEnum = pgEnum('reception_result', ['ACCEPTED', 'PARTIAL', 'REJECTED']);

/**
 * Estado del DT-e (ADR-012). Usa el vocabulario oficial de SENASA porque el
 * ciclo de vida lo define la norma, no la plataforma:
 *
 *   EMITIDO -> VIGENTE -> CERRADO           (circuito normal)
 *   VIGENTE -> VENCIDO -> CADUCADO          (sin cierre: bloquea al productor)
 *   VIGENTE / VENCIDO -> SIN_ARRIBO         (la sala declara que no llego)
 *   EMITIDO / VIGENTE -> ANULADO|ELIMINADO  (con o sin arancel abonado)
 *
 * BORRADOR, SOLICITADO y RECHAZADO son propios de ApiTrace: describen la
 * solicitud antes de que SIGSA asigne numero (o la rechace).
 */
export const dteStatusEnum = pgEnum('dte_status', [
  'BORRADOR',
  'SOLICITADO',
  'EMITIDO',
  'VIGENTE',
  'CERRADO',
  'VENCIDO',
  'CADUCADO',
  'SIN_ARRIBO',
  'RECHAZADO',
  'ANULADO',
  'ELIMINADO',
]);

/**
 * Canal por el que se obtuvo el numero del DT-e:
 *   MANUAL   numero emitido en SIGSA (web u oficina local) y transcripto aca.
 *   SIMULADO emision de prueba sin validez oficial (demos y homologacion interna).
 *   SIGSA    emision via API oficial de SENASA.
 */
export const dteIssueModeEnum = pgEnum('dte_issue_mode', ['MANUAL', 'SIMULADO', 'SIGSA']);

/** Quien provoco un cambio de estado del DT-e (historial sanitario). */
export const dteHistorySourceEnum = pgEnum('dte_history_source', ['USUARIO', 'SISTEMA', 'SENASA']);

/** Servicios de SENASA que el titular delega en ApiTrace via ARCA (ADMINREL). */
export const senasaServiceEnum = pgEnum('senasa_service', ['SIGSA_DTE', 'SITA']);

export const senasaDelegationStatusEnum = pgEnum('senasa_delegation_status', [
  'NO_INICIADA',
  'PENDIENTE',
  'ACEPTADA',
  'REVOCADA',
  'RECHAZADA',
]);

/** Estado de sincronizacion con el organismo externo (arquitectura, seccion 39). */
export const syncStatusEnum = pgEnum('sync_status', [
  'NOT_APPLICABLE',
  'PENDING_SYNC',
  'SYNCHRONIZED',
  'ERROR',
]);

export const externalSystemEnum = pgEnum('external_system', [
  'MANUAL',
  'SENASA_SIGSA',
  'SENASA_RENSPA',
  'SENASA_RENAPA',
  'ARCA',
  'SIFEGA',
  'LABORATORIO',
]);

export const documentTypeEnum = pgEnum('document_type', [
  'DTE',
  'REMITO',
  'FACTURA',
  'CERTIFICADO_ANALISIS',
  'CERTIFICADO_ORIGEN',
  'FOTO',
  'OTRO',
]);

export const lotTypeEnum = pgEnum('lot_type', [
  'EXTRACCION',
  'ACOPIO',
  'MEZCLA',
  'FRACCIONAMIENTO',
]);

export const lotStatusEnum = pgEnum('lot_status', [
  'OPEN',
  'CLOSED',
  'BLOCKED',
  'DISPATCHED',
  'CONSUMED',
]);

export const drumStatusEnum = pgEnum('drum_status', [
  'EMPTY',
  'FILLED',
  'IN_STOCK',
  'IN_TRANSIT',
  'DISPATCHED',
  'CONSUMED',
]);

/** Tipo de arista del grafo de trazabilidad hacia atras. */
export const lotInputSourceTypeEnum = pgEnum('lot_input_source_type', [
  'MOVEMENT',
  'LOT',
  'EXTRACTION',
  'MANUAL',
]);

export const extractionStatusEnum = pgEnum('extraction_status', [
  'DRAFT',
  'COMPLETED',
  'CANCELLED',
]);

export const sampleStatusEnum = pgEnum('sample_status', [
  'CREATED',
  'SENT',
  'IN_ANALYSIS',
  'RESULT_LOADED',
  'CLOSED',
  'REJECTED',
]);

export const inventoryEventTypeEnum = pgEnum('inventory_event_type', [
  'CREATED',
  'MOVED',
  'DISPATCHED',
  'RECEIVED',
  'CONSUMED',
  'ADJUSTED',
  'BLOCKED',
  'RELEASED',
]);

export const outboxStatusEnum = pgEnum('outbox_status', [
  'PENDING',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
]);

export const integrationStatusEnum = pgEnum('integration_status', [
  'SUCCESS',
  'ERROR',
  'TIMEOUT',
  'SKIPPED',
]);
