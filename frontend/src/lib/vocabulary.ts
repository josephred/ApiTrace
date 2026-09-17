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

  // --- documento sanitario -------------------------------------------------
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
  DTE_ISSUED: 'DT-e registrado',
  DTE_CLOSED: 'DT-e cerrado',
  DTE_APPROVED: 'DT-e aprobado',
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
}

/**
 * Textos de los botones «?». Regla: dos o tres frases como maximo, sin jerga.
 * Lo que antes ocupaba un parrafo permanente en cada encabezado vive acá y solo
 * aparece cuando alguien lo pide.
 */
export const HELP: Record<string, HelpEntry> = {
  producers: {
    title: 'Qué es un productor',
    body: 'Es quien responde por la actividad apícola. Su RENAPA se carga aparte porque son cosas distintas: un productor puede existir sin RENAPA vigente.',
  },
  renapa: {
    title: 'Qué es el RENAPA',
    body: 'Registro Nacional de Productores Apicolas. Identifica al apicultor ante SENASA. Mientras no exista integración automatica, queda marcado como sin verificar.',
  },
  establishments: {
    title: 'Qué es un establecimiento',
    body: 'Es el lugar fisico: un predio, una sala de extracción, un acopio. No confundir con el apiario, que es una unidad productiva dentro de un predio.',
  },
  renspa: {
    title: 'Qué es el RENSPA',
    body: 'Identifica al predio junto con su titular ante SENASA. El titular del predio puede no ser el mismo que trabaja las colmenas.',
  },
  rne: {
    title: 'Qué es el RNE',
    body: 'Registro Nacional de Establecimiento, del sistema SIFeGA. Aplica a salas, acopios y fraccionadoras.',
  },
  apiaries: {
    title: 'Qué es un apiario',
    body: 'El conjunto de colmenas ubicado en un punto concreto. Es el punto de partida real de la trazabilidad: permite responder de qué apiario salió la miel.',
  },
  movements: {
    title: 'Qué es un movimiento',
    body: 'El traslado de algo desde un establecimiento a otro. Es el evento que arma la cadena. El DT-e es un documento que lo acompana, no el movimiento en si.',
  },
  movementRule: {
    title: 'Por qué se pide un documento',
    body: 'El sistema mira la fecha del traslado y busca que norma regía ese día. Un traslado anterior al 01/08/2026 no exige DT-e aunque lo cargues hoy.',
  },
  scheduledAt: {
    title: 'Fecha del traslado',
    body: 'Es la fecha en que la mercadería se mueve, no la fecha en que la cargas. Con esa fecha se decide si hace falta DT-e.',
  },
  originApiary: {
    title: 'Para qué sirve el apiario de origen',
    body: 'Es opcional, pero es lo único que permite responder después de qué apiario vino la miel. Sin el, la trazabilidad llega hasta el predio y no mas.',
  },
  dte: {
    title: 'Qué es el DT-e',
    body: 'Documento de Transito Electrónico de SENASA. Acompana el traslado de productos de origen animal.',
  },
  extractions: {
    title: 'Qué es una extracción',
    body: 'El proceso en la sala que convierte los melarios recibidos en miel. Cada movimiento recibido puede procesarse una sola vez.',
  },
  yield: {
    title: 'Rendimiento',
    body: 'Cuanta miel se obtuvo respecto de lo que entró. Se calcula solo, no hace falta cargarlo.',
  },
  lots: {
    title: 'Qué es un lote',
    body: 'La unidad lógica de trazabilidad: agrupa lo que se extrajo o se acopio. Declarar de qué se compone es lo que permite reconstruir su origen.',
  },
  lotOrigin: {
    title: 'Por qué importa el origen',
    body: 'Un lote sin origen declarado corta la cadena: al consultar de dónde vino, el sistema no va a poder responder y lo va a marcar como hueco.',
  },
  availableQuantity: {
    title: 'Cantidad disponible',
    body: 'Lo que queda del lote sin usar en otros lotes. Baja cada vez que este lote alimenta a otro.',
  },
  drums: {
    title: 'Qué es un tambor',
    body: 'La unidad física donde se envasa la miel de un lote. La suma de los pesos netos no puede superar la cantidad del lote.',
  },
  trace: {
    title: 'Como leer la trazabilidad',
    body: 'Hacia atrás responde de dónde vino la miel. Hacia adelante, dónde terminó lo que salió de un origen. Los huecos indican qué falta para cerrar la cadena.',
  },
  gaps: {
    title: 'Qué son los huecos',
    body: 'Datos qué faltan para completar la cadena. El sistema prefiere avisarte qué falta algo antes que mostrar una cadena incompleta como si estuviera cerrada.',
  },
  rules: {
    title: 'Reglas documentales',
    body: 'Definen que traslados exigen documento. Son datos con fecha de vigencia: un cambio de norma se carga, no se programa.',
  },
  rulePriority: {
    title: 'Qué regla gana',
    body: 'Entre las reglas que aplican, gana la de menor número de prioridad, es decir, la más especifica. Si empatan, la de vigencia más reciente.',
  },
  audit: {
    title: 'Qué registra la auditoría',
    body: 'Quién hizo qué, sobre qué y cuándo. Se escribe sola y es independiente de los datos operativos.',
  },
  pending: {
    title: 'Cómo funciona la cola',
    body: 'Lo que registrás sin señal se guarda en el teléfono y se envía en orden cuando vuelve la conexión. Cada operación lleva una clave única, así que reenviarla nunca duplica nada.',
  },
  offline: {
    title: 'Trabajar sin conexión',
    body: 'Podés seguir consultando lo ya descargado y registrando operaciones nuevas. Todo se envía solo al recuperar señal.',
  },
  idempotency: {
    title: 'Por qué no se duplica',
    body: 'Cada operación viaja con una clave generada en tu dispositivo. Si el envío llegó pero se perdió la respuesta, el reintento usa la misma clave y el servidor lo reconoce.',
  },
};
