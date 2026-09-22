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

  // --- documento sanitario (compatibilidad) --------------------------------
  ISSUED: { label: 'Emitido', tone: 'info' },
  APPROVED: { label: 'Aprobado', tone: 'success' },
  CLOSED: { label: 'Cerrado', tone: 'success', hint: 'El destino cerró el documento tras recibir.' },
  PENDING_SYNC: {
    label: 'Sin verificar en SIGSA',
    tone: 'warning',
    hint: 'Registrado acá. Todavía no se confirmó contra SIGSA.',
  },
  SYNCHRONIZED: { label: 'Sincronizado con SIGSA', tone: 'success' },
  SYNC_ERROR: { label: 'Error al enviar', tone: 'danger' },
  ERROR: { label: 'Error al enviar', tone: 'danger', hint: 'SIGSA no respondió; se reintenta solo.' },

  // --- DT-e: estados oficiales de SENASA -----------------------------------
  BORRADOR: { label: 'Borrador', tone: 'neutral', hint: 'Preparado en ApiTrace, todavía sin número.' },
  SOLICITADO: { label: 'Solicitado', tone: 'info', hint: 'Enviado a SIGSA, esperando el número.' },
  EMITIDO: {
    label: 'Emitido',
    tone: 'warning',
    hint: 'Tiene número, pero todavía no transita: se habilita a las 00:00 de la fecha de carga.',
  },
  VIGENTE: { label: 'Vigente', tone: 'success', hint: 'Único estado que permite transitar.' },
  CERRADO: { label: 'Cerrado', tone: 'success', hint: 'La sala confirmó el arribo en SITA.' },
  VENCIDO: {
    label: 'Vencido',
    tone: 'danger',
    hint: 'Pasó la fecha de vencimiento sin cierre. La sala todavía puede cerrarlo durante 4 días.',
  },
  CADUCADO: {
    label: 'Caducado',
    tone: 'danger',
    hint: 'Sin cierre tras la gracia: SIGSA bloquea al productor para emitir nuevos DT-e.',
  },
  SIN_ARRIBO: { label: 'Sin arribo', tone: 'danger', hint: 'La sala declaró que la carga no llegó.' },
  RECHAZADO: { label: 'Rechazado', tone: 'danger', hint: 'SIGSA rechazó la solicitud.' },
  ANULADO: { label: 'Anulado', tone: 'neutral', hint: 'Dado de baja con el arancel abonado.' },
  ELIMINADO: { label: 'Eliminado', tone: 'neutral', hint: 'Dado de baja sin arancel abonado.' },

  // --- registros oficiales y delegaciones ----------------------------------
  EXPIRED: { label: 'Vencido', tone: 'danger' },
  NO_INICIADA: { label: 'No iniciada', tone: 'neutral' },
  PENDIENTE: { label: 'Pendiente', tone: 'warning', hint: 'Iniciada en ARCA, falta aceptarla.' },
  ACEPTADA: { label: 'Aceptada', tone: 'success' },
  REVOCADA: { label: 'Revocada', tone: 'danger' },
  RECHAZADA: { label: 'Rechazada', tone: 'danger' },

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

export const TRANSPORT_TYPES = dict({
  CAMION: 'Camión',
  CAMIONETA: 'Camioneta',
  FURGON: 'Furgón',
  UTILITARIO: 'Utilitario',
  OTRO: 'Otro',
});

/** Canal por el que se obtuvo el número del DT-e. */
export const ISSUE_MODES = dict({
  MANUAL: 'Emitido en SIGSA y registrado a mano',
  SIMULADO: 'Simulación (sin validez oficial)',
  SIGSA: 'Emitido por API de SIGSA',
});

export const INTEGRATION_MODES = dict({
  manual: 'Manual: se emite en SIGSA y se registra acá',
  simulado: 'Simulado: sin validez oficial',
  sigsa: 'SIGSA por API',
});

export const REGISTRATION_STATUSES = dict({
  ACTIVE: 'Habilitado',
  PENDING_VERIFICATION: 'Sin verificar',
  SUSPENDED: 'Suspendido',
  EXPIRED: 'Vencido',
  CANCELLED: 'Dado de baja',
});

export const SENASA_SERVICES = dict({
  SIGSA_DTE: 'SIGSA — emitir DT-e',
  SITA: 'SITA — cerrar DT-e en sala',
});

export const DELEGATION_STATUSES = dict({
  NO_INICIADA: 'No iniciada',
  PENDIENTE: 'Pendiente de aceptar',
  ACEPTADA: 'Aceptada',
  REVOCADA: 'Revocada',
  RECHAZADA: 'Rechazada',
});

/** Quién provocó un cambio de estado del DT-e. */
export const HISTORY_SOURCES: Record<string, string> = {
  USUARIO: 'Usuario',
  SISTEMA: 'Vigencia (automático)',
  SENASA: 'SENASA',
};

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
  DTE_CREATED: 'DT-e registrado',
  DTE_REQUESTED: 'Emisión solicitada a SIGSA',
  DTE_ISSUED: 'DT-e emitido',
  DTE_CLOSED: 'DT-e cerrado',
  DTE_APPROVED: 'DT-e aprobado',
  DTE_VOIDED: 'DT-e anulado',
  DTE_REJECTED: 'Solicitud de DT-e rechazada',
  DTE_NO_ARRIVAL: 'Declarado sin arribo',
  DTE_REGULARIZED: 'Caducidad regularizada',
  EXTRACTION_REGISTERED: 'Extracción registrada',
  PRODUCER_REGISTERED: 'Productor registrado',
  RENAPA_ASSOCIATED: 'RENAPA asociado',
  RENSPA_ASSOCIATED: 'RENSPA asociado',
  ESTABLISHMENT_REGISTERED: 'Establecimiento registrado',
  APIARY_REGISTERED: 'Apiario registrado',
  HIVE_REGISTERED: 'Colmena registrada',
  LOT_INPUT_ADDED: 'Entrada agregada al lote',
  LOT_TRANSFORMED: 'Lote transformado',
  DRUM_CREATED: 'Tambor envasado',
  DRUM_MOVED: 'Tambor trasladado',
  SAMPLE_CREATED: 'Muestra tomada',
  INVENTORY_MOVED: 'Inventario movido',
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

/**
 * El backend nombra los eventos en PascalCase (MovementCreated) y el
 * diccionario los tiene en MAYUSCULAS_CON_GUION (MOVEMENT_CREATED): se
 * normaliza antes de buscar, para que el historial no muestre «Movementcreated».
 */
const eventKey = (eventType: string): string =>
  eventType.includes('_')
    ? eventType
    : eventType.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();

export const eventLabel = (eventType: string | null | undefined): string =>
  eventType ? (EVENTS[eventKey(eventType)] ?? humanizeCode(eventType)) : '—';

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
  DTE_PENDING_SYNC: 'El DT-e está registrado pero todavía no se verificó contra SIGSA.',
  DTE_SIMULADO: 'El DT-e es una simulación: no tiene validez oficial.',
  DTE_VENCIDO_SIN_CIERRE: 'El DT-e venció sin que la sala lo cerrara.',
  DTE_CADUCADO: 'El DT-e caducó sin cierre: el traslado no quedó amparado.',
  DTE_SIN_ARRIBO: 'La sala declaró que la carga nunca llegó.',
  MISSING_REQUIRED_DOCUMENT: 'Un traslado que exigía documento no lo tiene.',
  RECEPTION_DISCREPANCY: 'La cantidad recibida difiere de la declarada en origen.',
  ESTABLISHMENT_WITHOUT_RENSPA: 'El establecimiento no tiene RENSPA registrado.',
  PRODUCER_WITHOUT_RENAPA: 'El productor no tiene RENAPA registrado.',
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
    regulation: 'Ley 27.233',
  },
  renapa: {
    title: '¿Qué es el RENAPA?',
    category: 'SENASA / Normativa',
    body: 'Registro Nacional de Productores Apícolas. Es una credencial obligatoria y gratuita emitida por la Secretaría de Bioeconomía/SENASA que certifica la actividad apícola con vigencia bianual.',
    example: 'El apicultor presenta RENAPA N° "BA-12049" con vencimiento en octubre de 2027 para habilitar el traslado de alzas cosechadas.',
  },
  establishments: {
    title: '¿Qué es un establecimiento?',
    category: 'Infraestructura',
    body: 'Es el predio o inmueble físico donde se asientan las colmenas o donde se procesan los productos: campos, salas de extracción, acopios o plantas de fraccionamiento.',
    example: 'Establecimiento rural "La Herradura" (campo arrendado para colmenas) vs Sala de Extracción comunitaria "San Ambrosio".',
  },
  renspa: {
    title: '¿Qué es el RENSPA?',
    category: 'SENASA / Sanidad',
    body: 'Registro Nacional Sanitario de Productores Agropecuarios. Código alfanumérico único que georreferencia e individualiza al predio rural y a su titular de explotación.',
    example: 'Formato oficial: 01.002.0.00123/00 (Provincia 01, Departamento 002, Establecimiento 0, Predio 00123, Explotación 00).',
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
  },
  movements: {
    title: '¿Qué es un movimiento de carga?',
    category: 'Trazabilidad Operativa',
    body: 'Registro del transporte físico de productos o insumos (alzas melarias, miel a granel, tambores, material vivo) desde un establecimiento emisor hacia un destino receptor.',
    example: 'Traslado de 60 melarios llenos desde el apiario hacia la sala de extracción habilitada para su desoperculado.',
  },
  movementRule: {
    title: '¿Por qué se exige documentación sanitaria?',
    category: 'Reglas de Tránsito',
    body: 'El motor de reglas evalúa el producto, establecimiento de origen, destino y fecha programada para determinar automáticamente si requiere DT-e oficial o remito interno.',
    example: 'Un traslado de alzas melarias de un apiario a una sala de extracción con fecha desde el 01/08/2026 exige DT-e (API-SEM); el mismo traslado con fecha anterior no lo exigía.',
  },
  scheduledAt: {
    title: 'Fecha de traslado vs Fecha de carga',
    category: 'Cronología Legal',
    body: 'Es el día y hora efectivos en que la mercadería emprende viaje por la ruta, no el momento en que se completó el formulario en el teléfono. Determina la vigencia legal del amparo.',
    example: 'Cargás la solicitud el viernes a la tarde para un traslado programado el lunes a las 06:00 hs: la vigencia del amparo comenzará el lunes.',
  },
  originApiary: {
    title: 'Apiario de origen',
    category: 'Trazabilidad Fina',
    body: 'Permite individualizar exactamente de qué grupo de colmenas provino la miel extraída. Si no se declara, la trazabilidad solo llega hasta el predio general.',
    example: 'Declarar "Apiario Los Robles" permite demostrar al comprador internacional la pureza floral de una miel monofloral de pradera.',
    regulation: 'Directiva UE 2001/110/CE',
  },
  dte: {
    title: 'Qué es el DT-e',
    body: 'Documento de Tránsito Electrónico de SENASA. Para llevar alzas melarias del apiario a la sala es obligatorio desde el 01/08/2026 (movimiento API-SEM).',
  },
  dteList: {
    title: 'Tus DT-e',
    body: 'Acá ves los DT-e que emite tu organización y los que llegan a tus salas. El estado ya tiene en cuenta la fecha: un DT-e emitido pasa solo a vigente el día de la carga.',
  },
  dteDeclared: {
    title: 'Por qué declarar de más',
    body: 'La sala no puede confirmar más alzas que las declaradas. Si llegan más, el DT-e se anula en la sala y hay que emitir otro. Declarar de más no tiene penalidad.',
  },
  dteValidity: {
    title: 'Vigencia del DT-e',
    body: 'Transita desde las 00:00 de la fecha de carga hasta las 23:59 del vencimiento (2 a 4 días después). Sin cierre, vence; 4 días después caduca y bloquea al productor.',
  },
  dteVerificationCode: {
    title: 'Código de cierre',
    body: 'Va impreso en el DT-e. La sala lo copia del papel para cerrarlo en SITA; por eso no se le muestra en pantalla.',
  },
  dteModes: {
    title: 'Canal de emisión',
    body: 'Mientras SENASA no habilite su API, el DT-e se emite en SIGSA y acá se registra el número. El modo simulado sirve para practicar: sus números no tienen validez.',
  },
  renapaApiary: {
    title: 'RENAPA del apiario',
    body: 'Identificación oficial del apiario: letra de la provincia, número de RENAPA y número de apiario (ej. B53999-2). Es el origen que figura en el DT-e.',
  },
  senasaSala: {
    title: 'Código SENASA de la sala',
    body: 'Identifica a la sala de extracción habilitada (ej. SEF-B-20010). Es el destino que figura en el DT-e.',
  },
  delegation: {
    title: 'Delegación en ApiTrace',
    body: 'Para que ApiTrace emita o cierre DT-e en tu nombre, delegá el servicio en ARCA (Administrador de Relaciones, formulario F3283/E). Acá solo se registra el estado.',
  },
  extractions: {
    title: '¿Qué es una extracción de miel?',
    category: 'Procesamiento en Sala',
    body: 'Operación en sala habilitada donde los cuadros desoperculados se centrifugan para obtener miel líquida, decantada y filtrada, separando la cera del néctar procesado.',
    example: 'Extracción #EX-2026-004: ingresaron 120 alzas cosechadas y se obtuvieron 2.150 kg de miel líquida lista para homogeneizar.',
  },
  yield: {
    title: 'Rendimiento de extracción',
    category: 'Métrica Productiva',
    body: 'Cálculo porcentual automático que compara los kilos netos de miel extraída respecto del peso o cantidad de alzas ingresadas al proceso.',
    example: 'Un rendimiento típico oscila entre 18 kg y 24 kg de miel por alza estándar tipo Langstroth bien operculada.',
  },
  lots: {
    title: '¿Qué es un lote de producción?',
    category: 'Trazabilidad Lógica',
    body: 'Unidad homogénea de miel procesada en una misma tirada o ciclo bajo condiciones uniformes. Es el objeto principal de auditoría, análisis de laboratorio y certificación.',
    example: 'Lote LOT-2026-A12: reúne 4.200 kg de miel multifloral de pradera extraída entre el 10 y el 12 de marzo en la sala central.',
    regulation: 'Capítulo X del Código Alimentario Argentino',
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
  },
  trace: {
    title: 'Navegación de trazabilidad integral',
    category: 'Cadena de Valor',
    body: 'Permite explorar la historia completa del producto: hacia atrás (backward) rastrea desde el tambor exportado hasta las colmenas; hacia adelante (forward) evalúa el destino final.',
    example: 'Ante una consulta de un importador alemán, ingresar el número de precinto permite aislar en segundos los apiarios de origen y las fechas de extracción.',
    regulation: 'Reglamento (CE) 178/2002',
  },
  gaps: {
    title: 'Huecos de trazabilidad',
    category: 'Alerta de Conformidad',
    body: 'Inconsistencias, saltos o faltantes de datos en la cadena que impiden reconstruir el ciclo completo. El sistema los señala antes de que el lote sea bloqueado por un auditor.',
    example: 'Un lote cuyos tambores no tienen registrado el movimiento de ingreso de alzas quedará señalado como "Hueco: falta origen".',
  },
  rules: {
    title: 'Reglas documentales dinámicas',
    category: 'Configuración Normativa',
    body: 'Parámetros configurables que definen qué combinaciones de origen, destino y producto exigen DT-e, remito o certificado sanitario según las resoluciones vigentes.',
    example: 'Regla «DT-e obligatorio: material melario de apiario a sala de extracción», vigente desde el 01/08/2026. Un cambio normativo se carga como una regla nueva con su vigencia.',
  },
  rulePriority: {
    title: 'Jerarquía y prioridad de reglas',
    category: 'Resolución de Conflictos',
    body: 'Cuando dos o más reglas coinciden para un mismo traslado, prevalece la de menor número de prioridad (regla más específica). A igual prioridad, rige la fecha de vigencia más reciente.',
    example: 'Una regla específica para "Traslado a Terminal Portuaria" (Prioridad 10) prevalece sobre la regla genérica "Traslado de miel a granel" (Prioridad 50).',
  },
  audit: {
    title: 'Registro inmutable de auditoría',
    category: 'Seguridad y Compliance',
    body: 'Bitácora donde el sistema registra fecha, hora, usuario, dirección IP y acción de cada operación relevante.',
    example: 'Si alguien anula un DT-e, queda registrado quién lo hizo, cuándo y con qué motivo.',
    regulation: 'Ley 25.326 de Protección de Datos Personales',
  },
  pending: {
    title: 'Cola de operaciones fuera de línea',
    category: 'Dispositivo y Conectividad',
    body: 'Las operaciones registradas sin señal se guardan en la base de datos local del navegador del teléfono y se envían solas cuando vuelve la cobertura.',
    example: 'Pesás 30 tambores en el apiario en medio del monte; al regresar al pueblo con WiFi la app envía la cola automáticamente sin duplicar registros.',
  },
  offline: {
    title: 'Operación autónoma offline',
    category: 'Resiliencia Operativa',
    body: 'ApiTrace es una aplicación web instalable (PWA). Sin internet permite consultar lo ya descargado y registrar operaciones que se envían al recuperar la señal. Un DT-e no se emite sin conexión: se puede preparar el borrador.',
    example: 'Durante la jornada en el campo podés registrar movimientos y colmenas; al volver la señal, la app los envía sin duplicarlos.',
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
  },
  reception: {
    title: 'Recepción y conformidad en destino',
    category: 'Control de Entrada',
    body: 'Verificación de la carga al llegar a sala o acopio: control de kilos reales pesados en báscula vs declarados en origen, estado de precintos y control de mermas.',
    example: 'Si salieron 10.000 kg y se reciben 9.940 kg, se anota una merma técnica de 60 kg (0.6%) y se emite la recepción con salvedad.',
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
  settings: {
    title: 'Configuración del sistema',
    category: 'Preferencias y Perfiles',
    body: 'Permite elegir el tema visual, activar o desactivar la ayuda contextual y revisar el estado del dispositivo y del canal de emisión de DT-e.',
    example: 'En el campo, bajo sol directo, conviene el tema claro; en la sala, el oscuro.',
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
  issueMode: 'Canal de emisión',
  declaredQuantity: 'Alzas declaradas',
  confirmedQuantity: 'Alzas confirmadas',
  loadDate: 'Fecha de carga',
  expiryDate: 'Vencimiento',
  originCode: 'Origen (RENAPA)',
  destinationCode: 'Destino (sala)',
  renapaCode: 'RENAPA del apiario',
  renapaStatus: 'Estado RENAPA',
  senasaCode: 'Código SENASA',
  senasaStatus: 'Habilitación SENASA',
  replacedDocuments: 'DT-e anteriores',
};

export const nodeAttrLabel = (key: string): string =>
  NODE_ATTRS[key] ?? humanizeCode(key.replace(/([A-Z])/g, ' $1'));

/** Campos cuyo valor es un estado del dominio y debe traducirse tambien. */
export const isStatusAttr = (key: string): boolean =>
  key === 'status' ||
  key === 'syncStatus' ||
  key === 'result' ||
  key === 'renapaStatus' ||
  key === 'senasaStatus';
