/**
 * Generador del catalogo de capturas de la guia de pantallas.
 *
 * Toma el build de produccion servido por `vite preview` y lo recorre con
 * Playwright, interceptando la API con datos deterministas. Las capturas no son
 * maquetas: es la aplicacion real, con su hoja de estilos y su service worker.
 *
 *   node capturas.mjs            → escribe en ./capturas/{escritorio,movil}
 */
import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import { mkdirSync } from 'node:fs';
const { chromium } = pw;

const BASE = 'http://localhost:4173';
const OUT = '/home/claude/capturas';

/* ======================================================================
   Datos de demostracion — la cadena completa del circuito apicola
   ====================================================================== */

const est = (id, name, type, rne = null) => ({
  id, name, type, organizationId: 'o1', producerId: 'p1',
  address: 'Ruta 5 km 142', locality: 'Chivilcoy', province: 'Buenos Aires',
  latitude: '-34.897600', longitude: '-60.017300', status: 'ACTIVE', rne,
});

const ORIGEN = est('e1', 'Predio Los Talas', 'APIARIO_BASE');
const SALA = est('e2', 'Sala San Andres', 'SALA_EXTRACCION', '02-001234');
const ACOPIO = est('e3', 'Acopio Pampa', 'ACOPIO', '02-004411');

const mov = (n, status, opts = {}) => ({
  id: `m${n}`,
  code: `MOV-2026-00000${n}`,
  movementType: 'MATERIAL_MELARIO',
  materialType: 'MATERIAL_MELARIO',
  originEstablishmentId: 'e1', originApiaryId: 'a1', destinationEstablishmentId: 'e2',
  scheduledAt: '2026-09-14T13:30:00.000Z',
  dispatchedAt: status === 'DRAFT' ? null : '2026-09-14T14:05:00.000Z',
  receivedAt: ['RECEIVED', 'PARTIALLY_RECEIVED'].includes(status) ? '2026-09-14T19:20:00.000Z' : null,
  quantity: opts.quantity ?? '480.000', unit: 'KG', status,
  requiresDocument: opts.requiresDocument ?? false,
  requiredDocumentType: opts.requiresDocument ? 'DT-e' : null,
  notes: opts.notes ?? null,
  origin: ORIGEN, destination: SALA,
  dte: opts.dte ?? null,
  reception: opts.reception ?? null,
});

const DTE_CERRADO = {
  id: 'dte1', movementId: 'm1', number: 'DTE-2026-0099814', status: 'CLOSED',
  issuedAt: '2026-09-14T13:10:00.000Z', closedAt: '2026-09-14T19:40:00.000Z',
  originRenspa: '01.006.0.00123/45', destinationRenspa: '01.006.0.00871/02',
  syncStatus: 'PENDING_SYNC',
};

const RECEPCION = {
  id: 'r1', movementId: 'm1', receivedAt: '2026-09-14T19:20:00.000Z',
  receivedQuantity: '468.500', unit: 'KG', result: 'PARTIAL', hasDiscrepancy: true,
  discrepancyNotes: 'Dos alzas con derrame por rotura del precinto en el traslado.',
};

const M1 = mov(1, 'PARTIALLY_RECEIVED', { requiresDocument: true, dte: DTE_CERRADO, reception: RECEPCION });
const M3 = mov(3, 'DRAFT', { requiresDocument: true, quantity: '312.000' });
const M4 = mov(4, 'DISPATCHED', { quantity: '255.500' });
const MOVS = [M1, mov(2, 'RECEIVED', { quantity: '390.000' }), M3, M4, mov(6, 'CANCELLED', { quantity: '120.000' })];

const lot = (n, status, type, opts = {}) => ({
  id: `l${n}`, code: `LOTE-2026-00000${n}`, organizationId: 'o1', establishmentId: 'e2',
  extractionId: 'x1', lotType: type, productionDate: '2026-09-15T00:00:00.000Z',
  quantity: opts.quantity ?? '612.400', availableQuantity: opts.available ?? '318.900',
  unit: 'KG', status, honeyType: opts.honeyType ?? 'Multifloral de pradera',
  moisturePercent: '17.4', color: 'Ámbar claro',
  inputs: opts.inputs, drums: opts.drums, summary: opts.summary,
});

const DRUMS = [
  { id: 'd1', code: 'TAM-2026-00041', lotId: 'l1', locationEstablishmentId: 'e3',
    netWeight: '298.600', tareWeight: '22.000', grossWeight: '320.600', unit: 'KG',
    status: 'IN_STOCK', sealNumber: 'PRE-77812', filledAt: '2026-09-15T12:00:00.000Z' },
  { id: 'd2', code: 'TAM-2026-00042', lotId: 'l1', locationEstablishmentId: 'e2',
    netWeight: '285.300', tareWeight: '22.000', grossWeight: '307.300', unit: 'KG',
    status: 'FILLED', sealNumber: 'PRE-77813', filledAt: '2026-09-15T14:30:00.000Z' },
];

const L1 = lot(1, 'OPEN', 'EXTRACCION', {
  inputs: [{ id: 'i1', lotId: 'l1', sourceType: 'EXTRACTION', sourceMovementId: null,
             sourceLotId: null, sourceExtractionId: 'x1', quantity: '612.400', unit: 'KG' }],
  drums: DRUMS,
  summary: { drumCount: 2, netWeightInDrums: 583.9, quantity: 612.4, availableQuantity: 318.9 },
});

const LOTS = [L1, lot(2, 'CLOSED', 'ACOPIO', { quantity: '980.000', available: '0.000' }),
              lot(3, 'OPEN', 'MEZCLA', { quantity: '240.000', available: '240.000', honeyType: null }),
              lot(4, 'BLOCKED', 'EXTRACCION', { quantity: '150.000', available: '150.000' })];

const APIARIOS = [
  { id: 'a1', establishmentId: 'e1', establishmentName: 'Predio Los Talas', code: 'API-001',
    name: 'El Ceibo', latitude: '-34.897600', longitude: '-60.017300', locality: 'Chivilcoy',
    province: 'Buenos Aires', hiveCount: 48, status: 'ACTIVE', registeredAt: '2026-02-11T00:00:00.000Z' },
  { id: 'a2', establishmentId: 'e1', establishmentName: 'Predio Los Talas', code: 'API-002',
    name: 'La Cañada', latitude: '-34.901200', longitude: '-60.022100', locality: 'Chivilcoy',
    province: 'Buenos Aires', hiveCount: 36, status: 'ACTIVE', registeredAt: null },
  { id: 'a3', establishmentId: 'e1', establishmentName: 'Predio Los Talas', code: 'API-003',
    name: null, latitude: null, longitude: null, locality: 'Suipacha',
    province: 'Buenos Aires', hiveCount: 12, status: 'INACTIVE', registeredAt: null },
];

const PRODUCTORES = [
  { id: 'p1', organizationId: 'o1', businessName: 'María González', personType: 'FISICA',
    taxId: '27-24558991-4', status: 'ACTIVE', email: 'maria@lostalas.test', phone: '2346-441122',
    province: 'Buenos Aires', locality: 'Chivilcoy', createdAt: '2026-01-10T00:00:00.000Z' },
  { id: 'p2', organizationId: 'o1', businessName: 'Cooperativa El Ceibo Ltda.', personType: 'JURIDICA',
    taxId: '30-71234567-4', status: 'PENDING_VERIFICATION', email: null, phone: null,
    province: 'Buenos Aires', locality: 'Suipacha', createdAt: '2026-03-02T00:00:00.000Z' },
];

const EXTRACCIONES = [
  { id: 'x1', code: 'EXT-2026-000001', establishmentId: 'e2', startedAt: '2026-09-15T11:00:00.000Z',
    finishedAt: '2026-09-15T20:00:00.000Z', status: 'COMPLETED', inputQuantity: '780.000',
    outputQuantity: '612.400', unit: 'KG', operatorName: 'Marcelo Ruiz' },
  { id: 'x2', code: 'EXT-2026-000002', establishmentId: 'e2', startedAt: '2026-09-16T11:00:00.000Z',
    finishedAt: null, status: 'IN_PROGRESS', inputQuantity: '455.000',
    outputQuantity: null, unit: 'KG', operatorName: 'Sandra Paz' },
];

const REGLAS = [
  { id: 'r1', name: 'Traslado de material melario a sala', movementType: 'MATERIAL_MELARIO',
    materialType: null, originType: 'APIARIO_BASE', destinationType: 'SALA_EXTRACCION',
    requiresDocument: true, requiredDocumentType: 'DT-e', effectiveFrom: '2026-08-01T00:00:00.000Z',
    effectiveTo: null, priority: 10, active: true, legalReference: 'Res. SENASA 123/2026, art. 4' },
  { id: 'r2', name: 'Miel a granel entre establecimientos', movementType: 'MIEL_A_GRANEL',
    materialType: null, originType: null, destinationType: null,
    requiresDocument: true, requiredDocumentType: 'DT-e', effectiveFrom: '2026-08-01T00:00:00.000Z',
    effectiveTo: null, priority: 20, active: true, legalReference: 'Res. SENASA 123/2026, art. 6' },
  { id: 'r3', name: 'Régimen anterior sin documento', movementType: null, materialType: null,
    originType: null, destinationType: null, requiresDocument: false, requiredDocumentType: null,
    effectiveFrom: '2020-01-01T00:00:00.000Z', effectiveTo: '2026-08-01T00:00:00.000Z',
    priority: 100, active: true, legalReference: null },
];

const AUDITORIA = [
  { id: 'au1', timestamp: '2026-09-15T20:02:00.000Z', actorEmail: 'sala@apitrace.test',
    action: 'EXTRACTION_COMPLETED', entityType: 'extraction', entityId: 'x1a2b3c4-1111', source: 'api', correlationId: null },
  { id: 'au2', timestamp: '2026-09-14T19:20:00.000Z', actorEmail: 'sala@apitrace.test',
    action: 'MOVEMENT_PARTIALLY_RECEIVED', entityType: 'movement', entityId: 'm1a2b3c4-2222', source: 'api', correlationId: null },
  { id: 'au3', timestamp: '2026-09-14T14:05:00.000Z', actorEmail: 'productor@apitrace.test',
    action: 'MOVEMENT_DISPATCHED', entityType: 'movement', entityId: 'm1a2b3c4-2222', source: 'api', correlationId: null },
  { id: 'au4', timestamp: '2026-09-14T13:10:00.000Z', actorEmail: null,
    action: 'DTE_ISSUED', entityType: 'dte', entityId: 'dte1a2b3-3333', source: 'system', correlationId: null },
];

const TIMELINE = (kind) => ({ events: kind === 'movement' ? [
  { id: 'e1', eventType: 'MOVEMENT_CREATED', occurredAt: '2026-09-13T12:00:00.000Z', recordedAt: '2026-09-13T12:00:00.000Z', actorUserId: 'u1', correlationId: null, payload: null },
  { id: 'e2', eventType: 'DTE_ISSUED', occurredAt: '2026-09-14T13:10:00.000Z', recordedAt: '2026-09-14T13:10:00.000Z', actorUserId: 'u1', correlationId: null, payload: null },
  { id: 'e3', eventType: 'MOVEMENT_DISPATCHED', occurredAt: '2026-09-14T14:05:00.000Z', recordedAt: '2026-09-14T14:07:00.000Z', actorUserId: 'u1', correlationId: null, payload: null },
  { id: 'e4', eventType: 'MOVEMENT_PARTIALLY_RECEIVED', occurredAt: '2026-09-14T19:20:00.000Z', recordedAt: '2026-09-14T19:22:00.000Z', actorUserId: 'u2', correlationId: null, payload: null },
  { id: 'e5', eventType: 'DTE_CLOSED', occurredAt: '2026-09-14T19:40:00.000Z', recordedAt: '2026-09-14T19:40:00.000Z', actorUserId: 'u2', correlationId: null, payload: null },
] : [
  { id: 'l1', eventType: 'LOT_CREATED', occurredAt: '2026-09-15T20:30:00.000Z', recordedAt: '2026-09-15T20:30:00.000Z', actorUserId: 'u2', correlationId: null, payload: null },
  { id: 'l2', eventType: 'DRUM_FILLED', occurredAt: '2026-09-15T12:00:00.000Z', recordedAt: '2026-09-15T12:01:00.000Z', actorUserId: 'u2', correlationId: null, payload: null },
  { id: 'l3', eventType: 'SAMPLE_TAKEN', occurredAt: '2026-09-16T09:00:00.000Z', recordedAt: '2026-09-16T09:00:00.000Z', actorUserId: 'u2', correlationId: null, payload: null },
]});

/* Cadena reconstruida hacia atrás desde el lote, con un hueco detectado. */
const TRACE = {
  direction: 'backward',
  root: { key: 'lot:l1', type: 'lot', id: 'l1', label: 'LOTE-2026-000001', attributes: {} },
  nodes: [
    { key: 'producer:p1', type: 'producer', id: 'p1', label: 'María González',
      attributes: { businessName: 'María González', personType: 'FISICA', taxId: '27-24558991-4', status: 'ACTIVE' } },
    { key: 'renapa:rn1', type: 'renapa', id: 'rn1', label: 'RENAPA 04-0091', attributes: { number: '04-0091', status: 'ACTIVE', syncStatus: 'PENDING_SYNC' } },
    { key: 'renspa:rs1', type: 'renspa', id: 'rs1', label: '01.006.0.00123/45', attributes: { number: '01.006.0.00123/45', activity: 'Apícola', status: 'ACTIVE' } },
    { key: 'establishment:e1', type: 'establishment', id: 'e1', label: 'Predio Los Talas',
      attributes: { name: 'Predio Los Talas', type: 'APIARIO_BASE', locality: 'Chivilcoy', province: 'Buenos Aires', status: 'ACTIVE' } },
    { key: 'apiary:a1', type: 'apiary', id: 'a1', label: 'API-001',
      attributes: { code: 'API-001', name: 'El Ceibo', hiveCount: 48, latitude: '-34.897600', longitude: '-60.017300', status: 'ACTIVE' } },
    { key: 'movement:m1', type: 'movement', id: 'm1', label: 'MOV-2026-000001',
      attributes: { code: 'MOV-2026-000001', movementType: 'MATERIAL_MELARIO', materialType: 'MATERIAL_MELARIO',
                    quantity: '480.000', unit: 'KG', scheduledAt: '2026-09-14T13:30:00.000Z',
                    dispatchedAt: '2026-09-14T14:05:00.000Z', receivedAt: '2026-09-14T19:20:00.000Z',
                    requiresDocument: true, requiredDocumentType: 'DT-e', status: 'PARTIALLY_RECEIVED' } },
    { key: 'dte:dte1', type: 'dte', id: 'dte1', label: 'DTE-2026-0099814',
      attributes: { number: 'DTE-2026-0099814', status: 'CLOSED', syncStatus: 'PENDING_SYNC',
                    issuedAt: '2026-09-14T13:10:00.000Z', closedAt: '2026-09-14T19:40:00.000Z',
                    originRenspa: '01.006.0.00123/45', destinationRenspa: '01.006.0.00871/02' } },
    { key: 'reception:r1', type: 'reception', id: 'r1', label: 'Recepción',
      attributes: { receivedQuantity: '468.500', unit: 'KG', hasDiscrepancy: true, result: 'PARTIAL',
                    discrepancyNotes: 'Dos alzas con derrame por rotura del precinto.' } },
    { key: 'establishment:e2', type: 'establishment', id: 'e2', label: 'Sala San Andres',
      attributes: { name: 'Sala San Andres', type: 'SALA_EXTRACCION', rne: '02-001234', status: 'ACTIVE' } },
    { key: 'extraction:x1', type: 'extraction', id: 'x1', label: 'EXT-2026-000001',
      attributes: { code: 'EXT-2026-000001', startedAt: '2026-09-15T11:00:00.000Z', finishedAt: '2026-09-15T20:00:00.000Z',
                    inputQuantity: '780.000', outputQuantity: '612.400', unit: 'KG', operatorName: 'Marcelo Ruiz', status: 'COMPLETED' } },
    { key: 'lot:l1', type: 'lot', id: 'l1', label: 'LOTE-2026-000001',
      attributes: { code: 'LOTE-2026-000001', lotType: 'EXTRACCION', quantity: '612.400',
                    availableQuantity: '318.900', unit: 'KG', honeyType: 'Multifloral de pradera',
                    moisturePercent: '17.4', productionDate: '2026-09-15T00:00:00.000Z', status: 'OPEN' } },
    { key: 'drum:d1', type: 'drum', id: 'd1', label: 'TAM-2026-00041',
      attributes: { code: 'TAM-2026-00041', netWeight: '298.600', tareWeight: '22.000', sealNumber: 'PRE-77812', status: 'IN_STOCK' } },
    { key: 'drum:d2', type: 'drum', id: 'd2', label: 'TAM-2026-00042',
      attributes: { code: 'TAM-2026-00042', netWeight: '285.300', tareWeight: '22.000', sealNumber: 'PRE-77813', status: 'FILLED' } },
  ],
  edges: [
    { from: 'producer:p1', to: 'renapa:rn1', relation: 'tiene RENAPA' },
    { from: 'producer:p1', to: 'renspa:rs1', relation: 'es titular de' },
    { from: 'renspa:rs1', to: 'establishment:e1', relation: 'identifica' },
    { from: 'establishment:e1', to: 'apiary:a1', relation: 'contiene' },
    { from: 'apiary:a1', to: 'movement:m1', relation: 'origen de' },
    { from: 'movement:m1', to: 'dte:dte1', relation: 'documentado por' },
    { from: 'movement:m1', to: 'reception:r1', relation: 'recibido como' },
    { from: 'movement:m1', to: 'establishment:e2', relation: 'destino' },
    { from: 'movement:m1', to: 'extraction:x1', relation: 'procesado en' },
    { from: 'extraction:x1', to: 'lot:l1', relation: 'produce' },
    { from: 'lot:l1', to: 'drum:d1', relation: 'envasado en' },
    { from: 'lot:l1', to: 'drum:d2', relation: 'envasado en' },
  ],
  summary: {
    producers: [{ id: 'p1', businessName: 'María González', renapa: ['04-0091'] }],
    renspa: ['01.006.0.00123/45'],
    apiaries: [{ id: 'a1', code: 'API-001', establishmentId: 'e1' }],
    establishments: [{ id: 'e1', name: 'Predio Los Talas', type: 'APIARIO_BASE' },
                     { id: 'e2', name: 'Sala San Andres', type: 'SALA_EXTRACCION' }],
    movements: [{ id: 'm1', code: 'MOV-2026-000001', status: 'PARTIALLY_RECEIVED', dteNumber: 'DTE-2026-0099814' }],
    lots: [{ id: 'l1', code: 'LOTE-2026-000001', status: 'OPEN' }],
    drums: [{ id: 'd1', code: 'TAM-2026-00041', netWeight: '298.600' },
            { id: 'd2', code: 'TAM-2026-00042', netWeight: '285.300' }],
  },
  gaps: [
    { severity: 'WARNING', code: 'DTE_PENDING_SYNC', message: 'El DT-e DTE-2026-0099814 no está sincronizado con SIGSA.' },
    { severity: 'WARNING', code: 'QUANTITY_MISMATCH', message: 'Se declararon 480,000 KG y se recibieron 468,500 KG.' },
  ],
  complete: false,
  generatedAt: '2026-09-17T10:00:00.000Z',
};

const page1 = (rows, total) => ({ data: rows, meta: { page: 1, pageSize: 25, total, totalPages: 1 } });

const ROUTES = [
  [/\/movements\?.*status=DISPATCHED/, page1([M4], 2)],
  [/\/movements\?.*status=DRAFT/, page1([M3], 1)],
  [/\/movements\/m1$/, M1],
  [/\/movements\/m3$/, M3],
  [/\/movements\?/, page1(MOVS, 14)],
  [/\/traceability\/timeline\/movement/, TIMELINE('movement')],
  [/\/traceability\/timeline\/lot/, TIMELINE('lot')],
  [/\/lots\/available-inputs/, [mov(7, 'RECEIVED', { quantity: '420.000' }), mov(8, 'RECEIVED', { quantity: '360.000' })]],
  [/\/lots\/l1$/, L1],
  [/\/lots\/l1\/trace\/backward/, TRACE],
  [/\/lots\?/, page1(LOTS, 9)],
  [/\/apiaries\?/, page1(APIARIOS, 3)],
  [/\/establishments\?.*type=APIARIO_BASE/, page1([ORIGEN], 1)],
  [/\/establishments\?.*type=SALA_EXTRACCION/, page1([SALA], 1)],
  [/\/establishments\?/, page1([ORIGEN, SALA, ACOPIO], 3)],
  [/\/extractions\?/, page1(EXTRACCIONES, 2)],
  [/\/drums\?/, page1(DRUMS, 2)],
  [/\/producers\?/, page1(PRODUCTORES, 2)],
  [/\/audit\/events/, page1(AUDITORIA, 128)],
  [/\/movement-rules/, REGLAS],
];

const session = (role, fullName, email) => ({
  accessToken: 'demo', refreshToken: 'demo',
  user: { id: 'u1', email, fullName, role, organizationId: role === 'AUDITOR' ? null : 'o1' },
});

const SALA_USER = session('SALA', 'Marcelo Ruiz', 'sala@apitrace.test');
const PROD_USER = session('PRODUCTOR', 'María González', 'productor@apitrace.test');
const AUD_USER = session('AUDITOR', 'Inspector SENASA', 'auditor@apitrace.test');

const COLA = [
  { id: 'q1', method: 'POST', path: '/apiaries', body: {}, idempotencyKey: 'k1',
    label: 'Apiario API-004', entity: '/apiaries', createdAt: 1789592400000, attempts: 0, status: 'PENDING' },
  { id: 'q2', method: 'POST', path: '/movements', body: {}, idempotencyKey: 'k2',
    label: 'Movimiento de Material melario (312 KG)', entity: '/movements',
    createdAt: 1789592700000, attempts: 0, status: 'PENDING' },
  { id: 'q3', method: 'POST', path: '/apiaries', body: {}, idempotencyKey: 'k3',
    label: 'Apiario API-001', entity: '/apiaries', createdAt: 1789593000000, attempts: 3,
    status: 'FAILED', lastError: 'Ya existe un apiario API-001 en ese establecimiento.' },
];

/* ======================================================================
   Guion de capturas
   ====================================================================== */

const VIEWS = [
  { name: 'escritorio', width: 1440, height: 940, scale: 2, mobile: false, theme: 'light' },
  { name: 'movil', width: 390, height: 844, scale: 3, mobile: true, theme: 'light' },
  { name: 'oscuro', width: 1440, height: 940, scale: 2, mobile: false, theme: 'dark' },
];

/** Cada entrada: [nombre, ruta, preparacion opcional, opciones] */
const SHOTS = [
  ['01-acceso-login', '/login', null, { anon: true }],
  ['10-panel-sala', '/', null, {}],
  ['12-panel-productor', '/', null, { user: PROD_USER }],
  ['15-panel-auditor', '/', null, { user: AUD_USER }],
  ['20-productores-listado', '/producers', null, {}],
  ['21-productores-alta', '/producers', async (p) => {
      await p.getByRole('button', { name: /Nuevo productor/ }).click();
      await p.waitForTimeout(400);
    }, { user: session('ADMIN', 'Administrador', 'admin@apitrace.test') }],
  ['24-productores-solo-lectura', '/producers', null, { user: AUD_USER }],
  ['30-establecimientos-listado', '/establishments', null, {}],
  ['31-establecimientos-alta', '/establishments', async (p) => {
      await p.getByRole('button', { name: /Nuevo establecimiento/ }).click();
      await p.waitForTimeout(400);
    }, {}],
  ['40-apiarios-listado', '/apiaries', null, { user: PROD_USER }],
  ['41-apiarios-alta', '/apiaries', async (p) => {
      await p.getByRole('button', { name: /Nuevo apiario/ }).click();
      await p.waitForTimeout(400);
    }, { user: PROD_USER }],
  ['50-movimientos-listado', '/movements', null, {}],
  ['51-movimiento-paso-1', '/movements', async (p) => {
      await p.getByRole('button', { name: /Nuevo movimiento/ }).click();
      await p.waitForTimeout(400);
    }, {}],
  ['52-movimiento-paso-2', '/movements', async (p) => {
      await p.getByRole('button', { name: /Nuevo movimiento/ }).click();
      await p.waitForTimeout(300);
      await p.locator('#f-quantity').fill('480');
      await p.getByRole('button', { name: 'Continuar' }).click();
      await p.waitForTimeout(400);
    }, {}],
  ['53-movimiento-paso-3', '/movements', async (p) => {
      await p.getByRole('button', { name: /Nuevo movimiento/ }).click();
      await p.waitForTimeout(300);
      await p.locator('#f-quantity').fill('480');
      await p.getByRole('button', { name: 'Continuar' }).click();
      await p.waitForTimeout(300);
      await p.locator('#f-originEstablishmentId').selectOption('e1');
      await p.locator('#f-destinationEstablishmentId').selectOption('e2');
      await p.getByRole('button', { name: 'Continuar' }).click();
      await p.waitForTimeout(400);
    }, {}],
  ['54-movimiento-detalle', '/movements/m1', null, {}],
  ['55-movimiento-detalle-borrador', '/movements/m3', null, {}],
  ['57-movimiento-registrar-dte', '/movements/m3', async (p) => {
      await p.getByRole('button', { name: /Registrar DT-e/ }).first().click();
      await p.waitForTimeout(400);
    }, {}],
  ['59-movimiento-cancelar', '/movements/m3', async (p) => {
      await p.getByRole('button', { name: /Cancelar movimiento/ }).click();
      await p.waitForTimeout(400);
    }, {}],
  ['61-extracciones-listado', '/extractions', null, {}],
  ['62-extraccion-paso-1', '/extractions', async (p) => {
      await p.getByRole('button', { name: /Nueva extracción/ }).click();
      await p.waitForTimeout(600);
    }, {}],
  ['70-lotes-listado', '/lots', null, {}],
  ['71-lote-alta-origen', '/lots', async (p) => {
      await p.getByRole('button', { name: /Nuevo lote/ }).click();
      await p.waitForTimeout(400);
      await p.locator('.sheet-body').evaluate((el) => { el.scrollTop = 420; });
      await p.waitForTimeout(200);
    }, {}],
  ['72-lote-detalle', '/lots/l1', null, {}],
  ['73-lote-registrar-tambor', '/lots/l1', async (p) => {
      await p.getByRole('button', { name: /Registrar tambor/ }).first().click();
      await p.waitForTimeout(400);
    }, {}],
  ['80-tambores-listado', '/drums', null, {}],
  ['90-trazabilidad-inicial', '/trace', null, {}],
  ['91-trazabilidad-resultado', '/trace/backward/lot/l1', null, {}],
  ['96-trazabilidad-detalle-nodo', '/trace/backward/lot/l1', async (p) => {
      await p.waitForTimeout(800);
      await p.locator('.trace-node').nth(5).click();
      await p.waitForTimeout(400);
      await p.locator('.trace-canvas').evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await p.waitForTimeout(300);
    }, {}],
  ['100-reglas-documentales', '/rules', null, { user: AUD_USER }],
  ['101-auditoria-listado', '/audit', null, { user: AUD_USER }],
  ['103-auditoria-sin-permiso', '/audit', null, { user: PROD_USER }],
  ['110-pendientes-vacio', '/pending', null, {}],
  ['113-pendientes-con-operaciones', '/pending', null, { queue: COLA }],
  ['111-offline-barra', '/movements', async (p, ctx) => {
      await ctx.setOffline(true);
      await p.evaluate(() => window.dispatchEvent(new Event('offline')));
      await p.waitForTimeout(500);
    }, {}],
  ['05-ayuda-contextual', '/movements', async (p) => {
      await p.getByRole('button', { name: /^Ayuda:/ }).first().click();
      await p.waitForTimeout(300);
    }, {}],
  ['07-menu-mas', '/', async (p) => {
      const mas = p.getByRole('button', { name: 'Más' });
      if (await mas.count()) { await mas.click(); await p.waitForTimeout(400); }
    }, { soloMovil: true }],
];

/*
   El tema oscuro no necesita repetir el catalogo entero: alcanza con un puñado
   de pantallas representativas para documentar que el sistema visual se sostiene
   en los dos temas.
*/
const EN_OSCURO = new Set([
  '01-acceso-login',
  '10-panel-sala',
  '50-movimientos-listado',
  '54-movimiento-detalle',
  '72-lote-detalle',
  '91-trazabilidad-resultado',
  '113-pendientes-con-operaciones',
]);

/* ====================================================================== */

const browser = await chromium.launch();
let hechas = 0;
const fallos = [];

for (const view of VIEWS) {
  mkdirSync(`${OUT}/${view.name}`, { recursive: true });

  for (const [name, path, prepare, opts = {}] of SHOTS) {
    if (opts.soloMovil && !view.mobile) continue;
    if (opts.soloEscritorio && view.mobile) continue;
    if (view.theme === 'dark' && !EN_OSCURO.has(name)) continue;

    const ctx = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      deviceScaleFactor: view.scale,
      isMobile: view.mobile, hasTouch: view.mobile,
      locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires',
    });

    await ctx.addInitScript((tema) => {
      try { localStorage.setItem('apitrace.theme', tema); } catch {}
    }, view.theme ?? 'light');

    await ctx.route('**/api/v1/**', (route) => {
      const url = route.request().url();
      for (const [re, body] of ROUTES) {
        if (re.test(url)) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        }
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(page1([], 0)) });
    });

    const user = opts.user ?? SALA_USER;
    if (!opts.anon) {
      await ctx.addInitScript((s) => {
        try { localStorage.setItem('apitrace.session', JSON.stringify(s)); } catch {}
      }, user);
    }

    // La cola vive en IndexedDB: se siembra antes de que arranque la aplicacion.
    if (opts.queue) {
      await ctx.addInitScript((items) => {
        const open = indexedDB.open('apitrace', 1);
        open.onupgradeneeded = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' });
          if (!db.objectStoreNames.contains('outbox')) {
            const store = db.createObjectStore('outbox', { keyPath: 'id' });
            store.createIndex('by-status', 'status');
            store.createIndex('by-created', 'createdAt');
          }
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        };
        open.onsuccess = () => {
          const tx = open.result.transaction('outbox', 'readwrite');
          for (const item of items) tx.objectStore('outbox').put(item);
        };
      }, opts.queue);
    }

    const page = await ctx.newPage();
    try {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.app, .auth-screen', { timeout: 20_000 });
      await page.waitForTimeout(900);
      if (prepare) await prepare(page, ctx);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/${view.name}/${name}.png` });
      hechas++;
    } catch (error) {
      fallos.push(`${view.name}/${name}: ${String(error).split('\n')[0]}`);
    }
    await page.close();
    await ctx.close();
  }
}

await browser.close();
console.log(`capturas: ${hechas}`);
if (fallos.length) {
  console.log('--- fallaron ---');
  for (const f of fallos) console.log('  ' + f);
}
