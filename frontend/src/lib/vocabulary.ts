/**
 * Vocabulario del sistema.
 *
 * Un único lugar donde los codigos del dominio se convierten en el idioma del
 * usuario. Antes cada pantalla mostraba el enum crudo (`PARTIALLY_RECEIVED`) o
 * lo humanizaba por su cuenta con resultados distintos; concentrarlo acá hace
 * que el mismo estado se lea igual en toda la aplicación y que un cambio de
 * redaccion sea un cambio en un solo archivo.
 *
 * Tratamiento: voseo rioplatense, frases cortas, sin jerga tecnica.
 */

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

export interface StatusInfo {
  label: string;
  tone: Tone;
  /** Explicacion breve, para la ayuda contextual. */
  hint?: string;
}

const STATUS: Record<string, StatusInfo> = {
  // --- genericos -----------------------------------------------------------
  ACTIVE: { label: 'Activo', tone: 'success' },
  INACTIVE: { label: 'Inactivo', tone: 'neutral' },
  SUSPENDED: { label: 'Suspendido', tone: 'danger', hint: 'Dado de baja temporalmente por el organismo.' },
  PENDING_VERIFICATION: {
    label: 'Sin verificar',
    tone: 'warning',
    hint: 'Cargado en el sistema, pero todavía no confirmado contra el registro oficial.',
  },

  // --- movimientos ---------------------------------------------------------
  DRAFT: { label: 'Borrador', tone: 'neutral', hint: 'Creado, todavía no salió del origen.' },
  DISPATCHED: { label: 'Despachado', tone: 'info', hint: 'Salió del establecimiento de origen.' },
  IN_TRANSIT: { label: 'En camino', tone: 'info' },
  RECEIVED: { label: 'Recibido', tone: 'success', hint: 'Llegó a destino y se registro la recepción.' },
  PARTIALLY_RECEIVED: {
    label: 'Recibido parcial',
    tone: 'warning',
    hint: 'Llegó menos cantidad de la declarada en origen.',
  },
  REJECTED: { label: 'Rechazado', tone: 'danger', hint: 'El destino no aceptó la mercadería.' },
  CANCELLED: { label: 'Cancelado', tone: 'danger' },

  // --- documento sanitario oficial API-SEM (11 estados) --------------------
  BORRADOR: { label: 'Borrador', tone: 'neutral', hint: 'Borrador local antes de solicitar a SENASA.' },
  SOLICITADO: { label: 'Solicitado', tone: 'info', hint: 'Enviado a SENASA, esperando número oficial.' },
  EMITIDO: { label: 'Emitido', tone: 'info', hint: 'Emitido con número oficial; carga pendiente.' },
  VIGENTE: { label: 'Vigente', tone: 'success', hint: 'En tránsito amparado por el DT-e.' },
  VENCIDO: { label: 'Vencido', tone: 'warning', hint: 'Superó la fecha de vencimiento sin cierre en sala.' },
  CADUCADO: { label: 'Caducado', tone: 'danger', hint: 'Caducado por SENASA sin completarse el traslado.' },
  CERRADO: { label: 'Cerrado', tone: 'success', hint: 'El destino confirmó la recepción y cerró el documento.' },
  SIN_ARRIBO: { label: 'Sin arribo', tone: 'danger', hint: 'El destino confirmó que la carga nunca llegó.' },
  ANULADO: { label: 'Anulado', tone: 'danger', hint: 'Anulado por el emisor antes de la carga.' },
  ELIMINADO: { label: 'Eliminado', tone: 'neutral', hint: 'Borrador descartado.' },
  RECHAZADO: { label: 'Rechazado', tone: 'danger', hint: 'Rechazado por SENASA o por el receptor.' },

  // --- documento sanitario (compatibilidad) --------------------------------
  ISSUED: { label: 'Emitido', tone: 'info' },
  APPROVED: { label: 'Aprobado', tone: 'success' },
  CLOSED: { label: 'Cerrado', tone: 'success', hint: 'El destino cerró el documento tras recibir.' },
  PENDING_SYNC: {
    label: 'Falta enviar a SIGSA',
    tone: 'warning',
    hint: 'Registrado acá. Se enviará cuando exista la integración con SIGSA.',
  },
  SYNCHRONIZED: { label: 'Enviado a SIGSA', tone: 'success' },
  SYNC_ERROR: { label: 'Error al enviar', tone: 'danger' },

  // --- lotes ---------------------------------------------------------------
  OPEN: { label: 'Abierto', tone: 'info', hint: 'Todavía se le puede sacar cantidad.' },
  BLOCKED: { label: 'Bloqueado', tone: 'danger', hint: 'Retenido: no puede usarse ni despacharse.' },
  CONSUMED: { label: 'Consumido', tone: 'neutral', hint: 'Ya se usó por completo en otros lotes.' },

  // --- tambores ------------------------------------------------------------
  FILLED: { label: 'Lleno', tone: 'info' },
  IN_STOCK: { label: 'En depósito', tone: 'success' },
  EMPTY: { label: 'Vacío', tone: 'neutral' },

  // --- extracciones --------------------------------------------------------
  IN_PROGRESS: { label: 'En proceso', tone: 'warning' },
  COMPLETED: { label: 'Terminada', tone: 'success' },

  // --- recepciones ---------------------------------------------------------
  ACCEPTED: { label: 'Aceptada', tone: 'success' },
  PARTIAL: { label: 'Parcial', tone: 'warning' },
};

export const statusInfo = (status: string | null | undefined): StatusInfo => {
  if (!status) return { label: '—', tone: 'neutral' };
  return STATUS[status] ?? { label: humanizeCode(status), tone: 'neutral' };
};

/** Último recurso: convierte SALA_EXTRACCION en «Sala extracción». */
export const humanizeCode = (value: string | null | undefined): string => {
  if (!value) return '—';
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

// ---------------------------------------------------------------------------
// Catalogos del dominio
// ---------------------------------------------------------------------------

const dict = (entries: Record<string, string>) => ({
  label: (value: string | null | undefined): string =>
    value ? (entries[value] ?? humanizeCode(value)) : '—',
  options: Object.entries(entries).map(([value, label]) => ({ value, label })),
});

export const MOVEMENT_TYPES = dict({
  MATERIAL_MELARIO: 'Material melario',
  MIEL_A_GRANEL: 'Miel a granel',
  PRODUCTO_FRACCIONADO: 'Producto fraccionado',
  MATERIAL_VIVO: 'Material vivo',
  MATERIAL_INERTE: 'Material inerte',
  OTRO: 'Otro',
});

export const MATERIAL_TYPES = dict({
  MATERIAL_MELARIO: 'Material melario',
  MIEL: 'Miel',
  CERA: 'Cera',
  POLEN: 'Polen',
  PROPOLEO: 'Propóleo',
  JALEA_REAL: 'Jalea real',
  NUCLEO: 'Núcleo',
  COLMENA: 'Colmena',
  OTRO: 'Otro',
});

/**
 * Material que corresponde por defecto a cada tipo de movimiento. Evita pedir
 * dos veces casi lo mismo: el usuario elige que traslada y el material se
 * deduce, quedando disponible para ajustarlo si hace falta.
 */
export const DEFAULT_MATERIAL: Record<string, string> = {
  MATERIAL_MELARIO: 'MATERIAL_MELARIO',
  MIEL_A_GRANEL: 'MIEL',
  PRODUCTO_FRACCIONADO: 'MIEL',
  MATERIAL_VIVO: 'COLMENA',
  MATERIAL_INERTE: 'CERA',
  OTRO: 'OTRO',
};

export const ESTABLISHMENT_TYPES = dict({
  APIARIO_BASE: 'Predio apícola',
  SALA_EXTRACCION: 'Sala de extracción',
  ACOPIO: 'Acopio',
  FRACCIONADORA: 'Fraccionadora',
  DEPOSITO: 'Depósito',
  LABORATORIO: 'Laboratorio',
  OTRO: 'Otro',
});

export const LOT_TYPES = dict({
  EXTRACCION: 'De extracción',
  ACOPIO: 'De acopio',
  MEZCLA: 'De mezcla',
  FRACCIONAMIENTO: 'De fraccionamiento',
});

export const PERSON_TYPES = dict({
  FISICA: 'Persona física',
  JURIDICA: 'Persona jurídica',
});

export const UNITS = dict({
  KG: 'Kilogramos',
  LITRO: 'Litros',
  ALZA: 'Alzas',
  TAMBOR: 'Tambores',
  COLMENA: 'Colmenas',
  UNIDAD: 'Unidades',
});

export const DTE_STATUSES = dict({
  BORRADOR: 'Borrador',
  SOLICITADO: 'Solicitado',
  EMITIDO: 'Emitido',
  VIGENTE: 'Vigente',
  VENCIDO: 'Vencido',
  CADUCADO: 'Caducado',
  CERRADO: 'Cerrado',
  SIN_ARRIBO: 'Sin arribo',
  ANULADO: 'Anulado',
  ELIMINADO: 'Eliminado',
  RECHAZADO: 'Rechazado',
});

export const DELEGATION_STATUSES = dict({
  PENDING: 'Pendiente',
  ACTIVE: 'Activa',
  EXPIRED: 'Vencida',
  REVOKED: 'Revocada',
});

export const SENASA_SERVICES = dict({
  DTE_APICOLA: 'DT-e Apícola (API-SEM)',
  SIGSA_GENERAL: 'SIGSA General',
  RENSPA: 'Consulta RENSPA',
});

export const ISSUE_MODES = dict({
  MANUAL: 'Carga manual (contingencia)',
  SIMULADO: 'Simulado (entorno de pruebas)',
  SIGSA: 'Web Service SIGSA (oficial)',
});

export const TRANSPORT_TYPES = dict({
  PROPIO: 'Transporte propio',
  TERCERO: 'Transporte de terceros',
  OTRO: 'Otro',
});

export const ROLES: Record<string, string> = {
  ADMIN: 'Administrador',
  PRODUCTOR: 'Productor',
  SALA: 'Sala de extracción',
  ACOPIADOR: 'Acopiador',
  FRACCIONADOR: 'Fraccionador',
  TRANSPORTISTA: 'Transportista',
  LABORATORIO: 'Laboratorio',
  EXPORTADOR: 'Exportador',
  AUDITOR: 'Auditor SENASA',
  CONSULTA: 'Consulta',
};

export const roleLabel = (role: string | null | undefined): string =>
  role ? (ROLES[role] ?? humanizeCode(role)) : '—';

export const SOURCE_TYPES: Record<string, string> = {
  MOVEMENT: 'Movimiento recibido',
  LOT: 'Otro lote',
  EXTRACTION: 'Extracción',
  MANUAL: 'Carga manual',
};

// ---------------------------------------------------------------------------
// Eventos: historial y auditoría
// ---------------------------------------------------------------------------

const EVENTS: Record<string, string> = {
  MOVEMENT_CREATED: 'Movimiento creado',
  MOVEMENT_DISPATCHED: 'Despachado',
  MOVEMENT_RECEIVED: 'Recepción registrada',
  MOVEMENT_PARTIALLY_RECEIVED: 'Recibido con diferencia',
  MOVEMENT_REJECTED: 'Rechazado en destino',
  MOVEMENT_CANCELLED: 'Cancelado',
  DTE_CREATED: 'DT-e borrador creado',
  DTE_REQUESTED: 'DT-e solicitado a SENASA',
  DTE_ISSUED: 'DT-e emitido',
  DTE_BECOMES_ACTIVE: 'DT-e entró en vigencia',
  DTE_EXPIRED: 'DT-e vencido',
  DTE_CLOSED: 'DT-e cerrado en destino',
  DTE_NO_ARRIVAL: 'DT-e declarado sin arribo',
  DTE_VOIDED: 'DT-e anulado',
  DTE_REGULARIZED: 'DT-e regularizado',
  DTE_REJECTED: 'DT-e rechazado por SENASA',
  DTE_APPROVED: 'DT-e aprobado',
  DTE_SYNC_OUTBOX_ENQUEUED: 'Sincronización encolada',
  DTE_SYNC_OUTBOX_SUCCESS: 'Sincronización enviada',
  DTE_SYNC_OUTBOX_FAILED: 'Fallo al sincronizar',
  EXTRACTION_STARTED: 'Extracción iniciada',
  EXTRACTION_COMPLETED: 'Extracción terminada',
  LOT_CREATED: 'Lote creado',
  LOT_CLOSED: 'Lote cerrado',
  LOT_BLOCKED: 'Lote bloqueado',
  DRUM_FILLED: 'Tambor envasado',
  DRUM_TRANSFERRED: 'Tambor trasladado',
  SAMPLE_TAKEN: 'Muestra tomada',
  RENAPA_LINKED: 'RENAPA asociado',
  RENSPA_LINKED: 'RENSPA asociado',
  PRODUCER_CREATED: 'Productor registrado',
  ESTABLISHMENT_CREATED: 'Establecimiento registrado',
  APIARY_CREATED: 'Apiario registrado',
  HIVE_CREATED: 'Colmena registrada',
  USER_LOGGED_IN: 'Inicio de sesión',
};

export const eventLabel = (eventType: string | null | undefined): string =>
  eventType ? (EVENTS[eventType] ?? humanizeCode(eventType)) : '—';

const ENTITIES: Record<string, string> = {
  movement: 'Movimiento',
  lot: 'Lote',
  drum: 'Tambor',
  producer: 'Productor',
  establishment: 'Establecimiento',
  apiary: 'Apiario',
  extraction: 'Extracción',
  dte: 'Documento DT-e',
  user: 'Usuario',
  sample: 'Muestra',
};

export const entityLabel = (entity: string | null | undefined): string =>
  entity ? (ENTITIES[entity] ?? humanizeCode(entity)) : '—';

// ---------------------------------------------------------------------------
// Huecos de trazabilidad
// ---------------------------------------------------------------------------

const GAPS: Record<string, string> = {
  DTE_PENDING_SYNC: 'El DT-e existe pero todavía no se envío a SIGSA.',
  MISSING_DTE: 'Un traslado que exigia documento no lo tiene.',
  LOT_WITHOUT_INPUTS: 'Un lote no declara de qué se compone: la cadena se corta ahí.',
  MISSING_RENAPA: 'El productor no tiene RENAPA vigente registrado.',
  MISSING_RENSPA: 'El establecimiento no tiene RENSPA registrado.',
  UNKNOWN_ORIGIN_APIARY: 'El movimiento no indica de qué apiario salió.',
  QUANTITY_MISMATCH: 'Las cantidades declaradas no cierran entre un paso y el siguiente.',
};

export const gapExplanation = (code: string): string =>
  GAPS[code] ?? 'Falta información para completar este tramo de la cadena.';

// ---------------------------------------------------------------------------
// Ayuda contextual
// ---------------------------------------------------------------------------

export interface HelpEntry {
  title: string;
  body: string;
  category?: string;
  example?: string;
  regulation?: string;
}

/**
 * Textos de los botones «?».
 *
 * Cada entrada provee definición conceptual, categoría temática, ejemplo
 * práctico de uso en campo y referencia técnica o legal aplicable.
 */
export const HELP: Record<string, HelpEntry> = {
  producers: {
    title: '¿Qué es un productor apícola?',
    category: 'Actores y Registro',
    body: 'Es la persona física o jurídica responsable de la explotación apícola y del cuidado sanitario de las colmenas. Su CUIT o CUIL identifica al titular ante ARCA/AFIP y SENASA.',
    example: 'Juan Gómez (CUIT 20-30456789-4) declara 150 colmenas distribuidas en tres apiarios de la cuenca del Salado.',
    regulation: 'Ley 27.233 / Res. SENASA 81/2019',
  },
  renapa: {
    title: '¿Qué es el RENAPA?',
    category: 'SENASA / Normativa',
    body: 'Registro Nacional de Productores Apícolas. Es una credencial obligatoria y gratuita emitida por la Secretaría de Bioeconomía/SENASA que certifica la actividad apícola con vigencia bianual.',
    example: 'El apicultor presenta RENAPA N° "BA-12049" con vencimiento en octubre de 2027 para habilitar el traslado de alzas cosechadas.',
    regulation: 'Res. SAGyP 85/2006 y modif. Res. 283/2001',
  },
  establishments: {
    title: '¿Qué es un establecimiento?',
    category: 'Infraestructura',
    body: 'Es el predio o inmueble físico donde se asientan las colmenas o donde se procesan los productos: campos, salas de extracción, acopios o plantas de fraccionamiento.',
    example: 'Establecimiento rural "La Herradura" (campo arrendado para colmenas) vs Sala de Extracción comunitaria "San Ambrosio".',
    regulation: 'Res. SENASA 581/2014',
  },
  renspa: {
    title: '¿Qué es el RENSPA?',
    category: 'SENASA / Sanidad',
    body: 'Registro Nacional Sanitario de Productores Agropecuarios. Código alfanumérico único que georreferencia e individualiza al predio rural y a su titular de explotación.',
    example: 'Formato oficial: 01.002.0.00123/00 (Provincia 01, Departamento 002, Establecimiento 0, Predio 00123, Explotación 00).',
    regulation: 'Res. SENASA 423/2014',
  },
  rne: {
    title: '¿Qué es el RNE?',
    category: 'Bromatología / SIFeGA',
    body: 'Registro Nacional de Establecimiento. Certificado expedido por la autoridad sanitaria jurisdiccional que habilita a la planta para elaborar, extraer, acopiar o fraccionar alimentos.',
    example: 'RNE 02-034891 otorgado a la Sala de Extracción de Miel del Parque Industrial de Tandil.',
    regulation: 'Código Alimentario Argentino (CAA) Capítulo II',
  },
  apiaries: {
    title: '¿Qué es un apiario?',
    category: 'Unidad Productiva',
    body: 'Conjunto geolocalizado de colmenas bajo un mismo manejo técnico dentro de un establecimiento. Es el nodo inicial indispensable de la cadena de trazabilidad apícola.',
    example: 'Apiario "El Bajo" compuesto por 45 colmenas activas situado en latitud -36.7821, longitud -59.1234.',
    regulation: 'Protocolo de Trazabilidad Apícola SENASA',
  },
  movements: {
    title: '¿Qué es un movimiento de carga?',
    category: 'Trazabilidad Operativa',
    body: 'Registro del transporte físico de productos o insumos (alzas melarias, miel a granel, tambores, material vivo) desde un establecimiento emisor hacia un destino receptor.',
    example: 'Traslado de 60 melarios llenos desde el apiario hacia la sala de extracción habilitada para su desoperculado.',
    regulation: 'Res. SENASA 58/2020 (Régimen de Tránsito de Mercancías Apícolas)',
  },
  movementRule: {
    title: '¿Por qué se exige documentación sanitaria?',
    category: 'Reglas de Tránsito',
    body: 'El motor de reglas evalúa el producto, establecimiento de origen, destino y fecha programada para determinar automáticamente si requiere DT-e oficial o remito interno.',
    example: 'El traslado de alzas cosechadas desde campo propio a sala de extracción del mismo titular requiere remito interno o DT-e según la zonificación sanitaria.',
    regulation: 'Matriz dinámica de resoluciones SENASA',
  },
  scheduledAt: {
    title: 'Fecha de traslado vs Fecha de carga',
    category: 'Cronología Legal',
    body: 'Es el día y hora efectivos en que la mercadería emprende viaje por la ruta, no el momento en que se completó el formulario en el teléfono. Determina la vigencia legal del amparo.',
    example: 'Cargás la solicitud el viernes a la tarde para un traslado programado el lunes a las 06:00 hs: la vigencia del amparo comenzará el lunes.',
    regulation: 'Art. 4 Res. SENASA 81/2019',
  },
  originApiary: {
    title: 'Apiario de origen',
    category: 'Trazabilidad Fina',
    body: 'Permite individualizar exactamente de qué grupo de colmenas provino la miel extraída. Si no se declara, la trazabilidad solo llega hasta el predio general.',
    example: 'Declarar "Apiario Los Robles" permite demostrar al comprador internacional la pureza floral de una miel monofloral de pradera.',
    regulation: 'Directiva UE 2001/110/CE / Norma SENASA',
  },
  dte: {
    title: '¿Qué es el DT-e (Documento de Tránsito)?',
    category: 'SENASA / Fiscal',
    body: 'Documento electrónico oficial que ampara el tránsito de animales y productos o subproductos de origen animal por el territorio argentino, certificando sanidad y origen.',
    example: 'DT-e N° 26-00128491-01 amparando 4.500 kg de miel a granel transportados por camión chasis patente AF-123-CD.',
    regulation: 'Res. SENASA 81/2019 / AFIP RG 3283',
  },
  dteTransit: {
    title: 'Semáforo de tránsito DT-e',
    category: 'Control en Ruta',
    body: 'Indica en tiempo real la validez del documento ante controles de Gendarmería, Policía de Tránsito o inspectores de SENASA en ruta.',
    example: 'VERDE: habilitado con vencimiento vigente. AMARILLO: vencimiento inminente en menos de 24 hs. ROJO: caduco, cerrado o sin arribo (no apto para circular).',
    regulation: 'Res. SENASA 81/2019 Anexo II',
  },
  dtePreflight: {
    title: 'Verificación previa (Preflight)',
    category: 'Validación Automática',
    body: 'Comprobación cruzada de seguridad antes de solicitar el DT-e oficial: valida que los RENSPA estén activos, las patentes no tengan bloqueos y la delegación fiscal esté vigente.',
    example: 'Si el camión ingresado tiene la VTV vencida o el RENSPA destino está suspendido, el preflight lo detecta y frena la emisión antes de incurrir en sanciones.',
    regulation: 'Validación Webhook API-SEM SENASA',
  },
  senasaDelegation: {
    title: 'Delegación de servicios SENASA / ARCA',
    category: 'Autorización Fiscal',
    body: 'Trámite digital mediante Clave Fiscal (Administrador de Relaciones de AFIP/ARCA) que apodera a ApiTrace para emitir y consultar DT-e en representación del CUIT del productor.',
    example: 'El apicultor delega el servicio "SIGSA - Trámites en Línea" a la CUIT de la cooperativa o proveedor tecnológico.',
    regulation: 'RG AFIP 3283/2012 Formulario 3283/E',
  },
  extractions: {
    title: '¿Qué es una extracción de miel?',
    category: 'Procesamiento en Sala',
    body: 'Operación en sala habilitada donde los cuadros desoperculados se centrifugan para obtener miel líquida, decantada y filtrada, separando la cera del néctar procesado.',
    example: 'Extracción #EX-2026-004: ingresaron 120 alzas cosechadas y se obtuvieron 2.150 kg de miel líquida lista para homogeneizar.',
    regulation: 'Res. SENASA 581/2014 Buenas Prácticas de Manufactura (BPM)',
  },
  yield: {
    title: 'Rendimiento de extracción',
    category: 'Métrica Productiva',
    body: 'Cálculo porcentual automático que compara los kilos netos de miel extraída respecto del peso o cantidad de alzas ingresadas al proceso.',
    example: 'Un rendimiento típico oscila entre 18 kg y 24 kg de miel por alza estándar tipo Langstroth bien operculada.',
    regulation: 'Estándar técnico INTA / SENASA',
  },
  lots: {
    title: '¿Qué es un lote de producción?',
    category: 'Trazabilidad Lógica',
    body: 'Unidad homogénea de miel procesada en una misma tirada o ciclo bajo condiciones uniformes. Es el objeto principal de auditoría, análisis de laboratorio y certificación.',
    example: 'Lote LOT-2026-A12: reúne 4.200 kg de miel multifloral de pradera extraída entre el 10 y el 12 de marzo en la sala central.',
    regulation: 'Capítulo X del CAA / Res. SAGyP 220/1995',
  },
  lotOrigin: {
    title: 'Composición y origen del lote',
    category: 'Cadena de Custodia',
    body: 'Declaración explícita de qué movimientos de materia prima y extracciones alimentaron el lote. Garantiza que no existan mezclas no autorizadas con miel de procedencia desconocida.',
    example: 'El lote L-09 se integra con 60% de miel del Apiario Norte y 40% del Apiario La Laguna; ambos con análisis libre de antibióticos.',
    regulation: 'Norma ISO 22005 Trazabilidad en la cadena alimentaria',
  },
  availableQuantity: {
    title: 'Cantidad disponible de lote',
    category: 'Gestión de Inventario',
    body: 'Stock remanente de miel del lote que aún no ha sido envasado en tambores ni transferido a otros lotes de homogeneización secundaria.',
    example: 'De un lote inicial de 5.000 kg, tras envasar 10 tambores de 300 kg netos cada uno, la cantidad disponible pasa a ser 2.000 kg.',
    regulation: 'Sistema de Balance de Masas',
  },
  drums: {
    title: '¿Qué es un tambor apícola?',
    category: 'Envase y Acopio',
    body: 'Contenedor metálico estándar de 200 litros (aprox. 300-330 kg netos) con recubrimiento epoxi sanitario apto para alimentos, identificado con código único y precinto inviolable.',
    example: 'Tambor TAM-0492: Peso bruto 352 kg, tara del envase 19 kg, peso neto de miel 333 kg.',
    regulation: 'Norma IRAM 2054 / Res. SENASA 121/1998',
  },
  trace: {
    title: 'Navegación de trazabilidad integral',
    category: 'Cadena de Valor',
    body: 'Permite explorar la historia completa del producto: hacia atrás (backward) rastrea desde el tambor exportado hasta las colmenas; hacia adelante (forward) evalúa el destino final.',
    example: 'Ante una consulta de un importador alemán, ingresar el número de precinto permite aislar en segundos los apiarios de origen y las fechas de extracción.',
    regulation: 'Reglamento (CE) 178/2002 Unión Europea / Res. SENASA 81/2019',
  },
  gaps: {
    title: 'Huecos de trazabilidad',
    category: 'Alerta de Conformidad',
    body: 'Inconsistencias, saltos o faltantes de datos en la cadena que impiden reconstruir el ciclo completo. El sistema los señala antes de que el lote sea bloqueado por un auditor.',
    example: 'Un lote cuyos tambores no tienen registrado el movimiento de ingreso de alzas quedará señalado como "Hueco: falta origen".',
    regulation: 'Auditoría de Inocuidad y Calidad Agroalimentaria',
  },
  rules: {
    title: 'Reglas documentales dinámicas',
    category: 'Configuración Normativa',
    body: 'Parámetros configurables que definen qué combinaciones de origen, destino y producto exigen DT-e, remito o certificado sanitario según las resoluciones vigentes.',
    example: 'Regla "Miel a granel interprovincial": exige obligatoriamente DT-e con vigencia máxima de 72 horas.',
    regulation: 'Resoluciones de Sanidad Animal SENASA',
  },
  rulePriority: {
    title: 'Jerarquía y prioridad de reglas',
    category: 'Resolución de Conflictos',
    body: 'Cuando dos o más reglas coinciden para un mismo traslado, prevalece la de menor número de prioridad (regla más específica). A igual prioridad, rige la fecha de vigencia más reciente.',
    example: 'Una regla específica para "Traslado a Terminal Portuaria" (Prioridad 10) prevalece sobre la regla genérica "Traslado de miel a granel" (Prioridad 50).',
    regulation: 'Criterio Lex Specialis Derogat Legi Generali',
  },
  audit: {
    title: 'Registro inmutable de auditoría',
    category: 'Seguridad y Compliance',
    body: 'Bitácora protegida donde el sistema estampa fecha, hora, usuario responsable, dirección IP, acción ejecutada y valores anteriores y nuevos de cada operación crítica.',
    example: 'Si un operario rectifica el peso neto de un tambor, el sistema conserva el valor original y el motivo documentado de la rectificación.',
    regulation: 'Estándar 21 CFR Part 11 / Ley 25.326 Protección de Datos',
  },
  pending: {
    title: 'Cola de operaciones fuera de línea',
    category: 'Dispositivo y Conectividad',
    body: 'Las operaciones registradas en el campo sin señal móvil (4G/3G) se resguardan de forma segura en la base de datos local del teléfono y se sincronizan solas en cuanto hay cobertura.',
    example: 'Pesás 30 tambores en el apiario en medio del monte; al regresar al pueblo con WiFi la app envía la cola automáticamente sin duplicar registros.',
    regulation: 'Almacenamiento W3C IndexedDB con cifrado local',
  },
  offline: {
    title: 'Operación autónoma offline',
    category: 'Resiliencia Operativa',
    body: 'ApiTrace está diseñada como Progressive Web App (PWA). Permite crear movimientos, consultar apiarios precargados y emitir comprobantes en campo sin internet.',
    example: 'Podés trabajar normalmente durante toda la jornada rural sin conectividad; ninguna acción se pierde por cortes o caídas de red.',
    regulation: 'Arquitectura Offline-First con Service Workers',
  },
  idempotency: {
    title: 'Garantía de clave única (Idempotencia)',
    category: 'Seguridad Transaccional',
    body: 'Cada operación creada en el dispositivo genera un identificador universal único (UUIDv4). Si la conexión parpadea y la app reenvía el paquete, el servidor lo detecta y no duplica.',
    example: 'Si presionás "Guardar" dos veces por lentitud en la antena celular, el sistema procesa solo la primera y entrega la misma respuesta sin crear dos registros.',
    regulation: 'Estándar IETF RFC 7231 (HTTP Idempotent Methods)',
  },
  dispatch: {
    title: 'Despacho de mercadería en origen',
    category: 'Operación en Campo',
    body: 'Momento en que el transportista carga el vehículo, se verifican los precintos de seguridad y se firma la constancia de salida del establecimiento emisor.',
    example: 'Carga de 60 tambores en camión térmico; se verifica que el precinto número 994012 esté colocado y sano antes de la partida.',
    regulation: 'Guía de Tránsito y Control SENASA',
  },
  reception: {
    title: 'Recepción y conformidad en destino',
    category: 'Control de Entrada',
    body: 'Verificación de la carga al llegar a sala o acopio: control de kilos reales pesados en báscula vs declarados en origen, estado de precintos y control de mermas.',
    example: 'Si salieron 10.000 kg y se reciben 9.940 kg, se anota una merma técnica de 60 kg (0.6%) y se emite la recepción con salvedad.',
    regulation: 'Tolerancia técnica comercial SENASA',
  },
  tareWeight: {
    title: 'Tara y peso neto del tambor',
    category: 'Metrología Legal',
    body: 'La tara es el peso del tambor metálico vacío con su tapa y aro (habitualmente entre 17,5 y 19,5 kg). El peso neto es la resta del peso bruto medido menos la tara.',
    example: 'Peso bruto en báscula: 348 kg. Tara del envase: 18 kg. Miel neta comercializable: 330 kg.',
    regulation: 'Ley 19.511 de Metrología Legal Argentina',
  },
  drumSeal: {
    title: 'Precinto de seguridad inviolable',
    category: 'Seguridad de Carga',
    body: 'Dispositivo numerado irrepetible colocado en el aro de cierre del tambor que garantiza que la miel no ha sido adulterada, abierta ni contaminada durante el flete.',
    example: 'Precinto plástico tipo pulsera roja número "SENASA-B-084920" registrado al pie de la extracción.',
    regulation: 'Res. SENASA 581/2014 Anexo III',
  },
  honeyType: {
    title: 'Origen botánico y floral de la miel',
    category: 'Tipificación y Calidad',
    body: 'Clasificación de la miel según la flora predominante recolectada por las abejas (Multifloral de Pradera, Eucalipto, Monte Nativo, Trébol, Isla).',
    example: 'Miel monofloral de Eucalipto con color ámbar claro y aroma característico de floración invernal.',
    regulation: 'Código Alimentario Argentino Artículo 782',
  },
  moisture: {
    title: 'Porcentaje de humedad en miel',
    category: 'Parámetro Físico-Químico',
    body: 'Contenido de agua medido con refractómetro calibrado. El límite máximo legal para evitar fermentaciones es del 18,0% (18,5% máximo según destino de exportación).',
    example: 'Lote medido con 17,2% de humedad: condición óptima para almacenamiento prolongado y exportación a la Unión Europea.',
    regulation: 'CAA Art. 783 / Norma Codex Stan 12-1981',
  },
  dteVerificationCode: {
    title: 'Código de verificación oficial SENASA',
    category: 'Seguridad Documental',
    body: 'Código alfanumérico o código QR emitido por los servidores de SENASA/SIGSA que valida la autenticidad del DT-e ante cualquier autoridad policial o fiscal en ruta.',
    example: 'Código de 12 dígitos "V4K9-2P8M-7X1Q" verificable desde la app pública de SENASA o escaneo de QR en el formulario papel.',
    regulation: 'Res. SENASA 81/2019 Anexo I',
  },
  settings: {
    title: 'Configuración del sistema',
    category: 'Preferencias y Perfiles',
    body: 'Permite personalizar el comportamiento de la aplicación, alternar el tema visual, habilitar o deshabilitar la asistencia guiada y configurar parámetros operativos según tu rol asignado.',
    example: 'Una sala de extracción puede fijar la tara estándar de 18.5 kg y los rangos de alerta de rendimiento de centrifugado.',
    regulation: 'Personalización segura en almacenamiento local (W3C Storage)',
  },
};

// ---------------------------------------------------------------------------
// Atributos de los nodos del grafo de trazabilidad
// ---------------------------------------------------------------------------

/**
 * El backend devuelve los atributos de cada nodo con el nombre del campo del
 * modelo, en ingles. Mostrarlos tal cual era la unica parte de la aplicacion
 * que no hablaba el idioma del usuario (hallazgo H-04 de la guia de pantallas).
 */
const NODE_ATTRS: Record<string, string> = {
  code: 'Código',
  name: 'Nombre',
  label: 'Etiqueta',
  status: 'Estado',
  syncStatus: 'Envío a SIGSA',
  type: 'Tipo',
  number: 'Número',
  businessName: 'Razón social',
  personType: 'Tipo de persona',
  taxId: 'CUIT',
  locality: 'Localidad',
  province: 'Provincia',
  address: 'Domicilio',
  latitude: 'Latitud',
  longitude: 'Longitud',
  rne: 'RNE',
  activity: 'Actividad',
  hiveCount: 'Colmenas',
  establishmentName: 'Establecimiento',
  movementType: 'Tipo de traslado',
  materialType: 'Material',
  quantity: 'Cantidad',
  unit: 'Unidad',
  scheduledAt: 'Fecha del traslado',
  dispatchedAt: 'Despachado',
  receivedAt: 'Recibido',
  issuedAt: 'Emitido',
  closedAt: 'Cerrado',
  requiresDocument: 'Exige documento',
  requiredDocumentType: 'Documento exigido',
  originRenspa: 'RENSPA origen',
  destinationRenspa: 'RENSPA destino',
  receivedQuantity: 'Cantidad recibida',
  hasDiscrepancy: 'Con diferencia',
  discrepancyNotes: 'Motivo de la diferencia',
  result: 'Resultado',
  startedAt: 'Inicio',
  finishedAt: 'Fin',
  inputQuantity: 'Ingresado',
  outputQuantity: 'Obtenido',
  operatorName: 'Operario',
  lotType: 'Tipo de lote',
  productionDate: 'Fecha de producción',
  availableQuantity: 'Disponible',
  honeyType: 'Tipo de miel',
  moisturePercent: 'Humedad (%)',
  color: 'Color',
  netWeight: 'Peso neto',
  tareWeight: 'Tara',
  grossWeight: 'Peso bruto',
  sealNumber: 'Precinto',
  filledAt: 'Fecha de llenado',
  registeredAt: 'Registrado',
  depth: 'Profundidad en la cadena',
  organizationId: 'Organización',
};

export const nodeAttrLabel = (key: string): string =>
  NODE_ATTRS[key] ?? humanizeCode(key.replace(/([A-Z])/g, ' $1'));

/** Campos cuyo valor es un estado del dominio y debe traducirse tambien. */
export const isStatusAttr = (key: string): boolean =>
  key === 'status' || key === 'syncStatus' || key === 'result';
