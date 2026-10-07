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
    title: '¿Quién es el productor apícola?',
    category: 'Actores y Personas',
    body: 'Es la persona (o empresa) que cuida a las abejas con dedicación, les da un lugar seguro en el campo y junta la miel cuando está lista. Ante la ley, es el titular responsable de la salud de sus colmenas y quien firma todos los papeles oficiales para que la miel pueda venderse.',
    example: 'Don Juan tiene 150 colmenas distribuidas en tres campos de Chascomús. Como él es el productor, figura con su CUIT en todos los certificados oficiales.',
    regulation: 'Ley Nacional 27.233 y Registro Nacional de Productores Apícolas (RENAPA)',
  },
  renapa: {
    title: '¿Qué es el RENAPA?',
    category: 'Permisos y Documentos',
    body: 'Es como el DNI o la credencial oficial del apicultor. Es un carnet gratuito que entrega el gobierno (la Secretaría de Bioeconomía y SENASA) para certificar: «¡Sí, esta persona es un apicultor de verdad y sus abejas están cuidadas!». Se renueva cada dos años para asegurar que la actividad sigue activa.',
    example: 'María presenta su credencial N° "BA-12049" con vencimiento en 2027. Con ese número, las autoridades de la ruta saben que sus alzas están en regla.',
    regulation: 'Resolución SAGyP N° 283/2001 (Registro Nacional de Productores Apícolas)',
  },
  establishments: {
    title: '¿Qué es un establecimiento?',
    category: 'Lugares y Predios',
    body: 'Es el lugar físico o terreno donde pasan las cosas de la miel. Puede ser un campo con flores donde descansan las colmenas, una sala limpia con extractores donde se centrifuga la miel, un galpón de acopio donde se apilan tambores o una fábrica donde se fracciona en frasquitos de vidrio.',
    example: 'El campo "Los Eucaliptos" donde están los cajones es un establecimiento, y la sala comunitaria "San Ambrosio" del pueblo donde se saca la miel es otro establecimiento.',
    regulation: 'Resolución SENASA N° 423/2014',
  },
  renspa: {
    title: '¿Qué es el RENSPA?',
    category: 'Permisos y Sanidad',
    body: 'Es la partida de nacimiento del campo o predio rural. Si el RENAPA es el DNI del productor, el RENSPA es el número de documento de la tierra donde viven las abejas. Le dice a SENASA en qué punto exacto del mapa argentino se encuentran las colmenas para cuidarlas y controlar que no haya plagas en la zona.',
    example: 'Tiene un formato como "01.002.0.00123/00". Con ese código, los veterinarios saben exactamente en qué departamento y parcela rural está asentado el apiario.',
    regulation: 'Resolución SENASA N° 423/2014 (Registro Nacional Sanitario de Productores Agropecuarios)',
  },
  rne: {
    title: '¿Qué es el RNE?',
    category: 'Higiene y Alimentos',
    body: 'Significa Registro Nacional de Establecimiento. Es como el diploma de higiene de un restaurante, pero para las plantas donde se procesa miel. Demuestra que el edificio está súper limpio, tiene agua potable, paredes lavables, no entran insectos ni polvo, y está autorizado por bromatología para manipular comida que la gente va a consumir.',
    example: 'La Sala de Extracción tiene su cartel "RNE 02-034891" en la entrada, garantizando que adentro todo el acero inoxidable y las maquinarias se desinfectan bajo norma.',
    regulation: 'Código Alimentario Argentino (CAA), Capítulo II',
  },
  apiaries: {
    title: '¿Qué es un apiario?',
    category: 'En el Campo',
    body: 'Es la "aldea" o el grupito de cajones donde viven y trabajan las abejas en un rincón del campo. En un mismo campo podés tener dos o tres apiarios separados (por ejemplo: uno cerca de la laguna y otro cerca del monte nativo) para que las abejas junten néctar de flores diferentes.',
    example: 'El apiario "Bajo del Arroyo" tiene 45 cajones de madera pintados de blanco, todos ordenados mirando hacia el sol de la mañana.',
    regulation: 'Guía de Buenas Prácticas Apícolas (SENASA / INTA)',
  },
  hives: {
    title: '¿Qué es una colmena?',
    category: 'En el Campo',
    body: 'Es la casita de madera donde vive una familia entera de abejas: la reina que pone los huevitos, las obreras que limpian y buscan néctar, y los zánganos. Adentro construyen panales de cera hexagonales perfectos. Cuando la familia crece mucho y junta mucha miel, el apicultor le coloca arriba un piso extra llamado "alza".',
    example: 'Si un apiario tiene 50 colmenas activas, significa que hay 50 familias de abejitas trabajando todos los días juntando polen y miel.',
    regulation: 'Manual de Sanidad Apícola SENASA',
  },
  movements: {
    title: '¿Qué es un movimiento de carga?',
    category: 'El Viaje de la Miel',
    body: 'Es el viaje en vehículo de un lugar a otro. Por ejemplo: cuando cargás las alzas llenas de miel en la camioneta y las llevás desde el campo hacia la sala de extracción del pueblo, o cuando llevás tambores pesados de 300 kilos desde la sala hacia el puerto para exportar.',
    example: 'El traslado de 70 alzas cosechadas que hizo la camioneta desde el campo "La Querencia" hasta la extractora de Tandil el martes por la mañana.',
    regulation: 'Sistema de Trazabilidad Apícola SENASA',
  },
  movementRule: {
    title: '¿Por qué el sistema pide papeles sanitarios?',
    category: 'Reglas del Camino',
    body: 'El sistema tiene un "semáforo inteligente" incorporado: revisa qué cosas llevás (¿alzas con miel? ¿colmenas vivas? ¿tambores?), desde dónde salís y hacia dónde vas. Con eso sabe de memoria la ley y te avisa al instante si necesitás un DT-e oficial de SENASA o si te alcanza con un remito comercial común.',
    example: 'Llevar alzas con miel hacia una sala de extracción a partir del 1 de agosto de 2026 exige obligatoriamente un DT-e (API-SEM); antes de esa fecha no se exigía.',
    regulation: 'Resolución SENASA 2026 (Control de Tránsito Apícola)',
  },
  movementStatus: {
    title: '¿Qué significan los estados del viaje?',
    category: 'El Viaje de la Miel',
    body: 'Te van contando en qué etapa del camino está la mercadería: "Borrador" (lo estás preparando en casa), "Despachado" o "En camino" (el camión ya salió a la ruta) y "Recibido" (llegó a destino y la sala descargó y confirmó los kilos).',
    example: 'Cuando el camión sale de la tranquera pasa a "En camino", y cuando la sala abre el portón y descarga pasa a "Recibido".',
    regulation: 'Ciclo Operativo de Carga SENASA',
  },
  scheduledAt: {
    title: 'Fecha de traslado vs. Fecha de carga',
    category: 'El Reloj del Viaje',
    body: 'Es el día exacto en que la camioneta va a salir a rodar por la ruta con las alzas. No importa si completaste los datos en el teléfono el viernes a la noche tomando mate en tu casa: lo que cuenta para la ley es el día en que el vehículo sale a transitar.',
    example: 'Completás el trámite el viernes pero ponés fecha de carga para el lunes a las 07:00 hs: el permiso legal de viaje empezará a tener validez el lunes.',
    regulation: 'SIGSA / SENASA - Ventana de Validez de Tránsito',
  },
  originApiary: {
    title: '¿Por qué declarar el apiario de origen?',
    category: 'Identidad de la Miel',
    body: 'Porque permite saber de qué rincón exacto del campo provino la miel. Si anotás de qué apiario salió, podés demostrarle al comprador que tu miel es pura de flor de trébol, de monte nativo o de eucalipto. Si no lo ponés, solo sabrán el nombre del campo pero se pierde la receta de origen.',
    example: 'Declarar que la miel viene del "Apiario Las Acacias" permite venderla como miel monofloral certificada a mejor precio porque tenés el comprobante de origen.',
    regulation: 'Código Alimentario Argentino y Directiva Unión Europea 2001/110/CE',
  },
  dte: {
    title: '¿Qué es el DT-e y para qué sirve?',
    category: 'Permisos y Trámites',
    body: 'El DT-e (Documento de Tránsito Electrónico) es como el "pasaporte" de las alzas melarias. Es una autorización oficial emitida por SENASA que demuestra que la miel es sana, que las colmenas están libres de enfermedades y que tenés permiso para circular por la ruta. Desde agosto de 2026, ningún vehículo con alzas puede circular sin este papel.',
    example: 'Si la policía rural te frena en el camino, le mostrás el DT-e en el celular o impreso en papel y ven que tenés permiso legal para transportar 70 alzas a la sala.',
    regulation: 'Resolución SENASA sobre Tránsito de Material Apícola (API-SEM)',
  },
  dteList: {
    title: '¿Cómo funciona la lista de DT-e?',
    category: 'Control de Trámites',
    body: 'Es tu tablero de control de viajes. Si sos productor, te muestra los trámites que emitiste para salir a la ruta. Si sos el encargado de una sala de extracción, te muestra los viajes que están viniendo hacia tu fábrica para que estés listo para recibirlos y pesarlos.',
    example: 'Ves en verde los DT-e que están viajando hoy mismo ("Vigentes") y en gris los que ya entregaste y la sala ya confirmó y cerró ("Cerrados").',
    regulation: 'Sistema Integrado de Gestión de Sanidad Animal (SIGSA)',
  },
  dteDeclared: {
    title: '¿Por qué conviene declarar alzas de más?',
    category: 'Consejo del Apicultor',
    body: '¡Este es el mejor secreto de campo! La ley de SENASA prohíbe terminantemente descargar en la sala ni una sola alza más de las que anotaste en el papel. Si anotaste 50 y en la camioneta entraron 52, el trámite se anula y hay que hacer otro antes de descargar. En cambio, si declarás 60 y llevás 52, no hay ningún problema: la sala confirma las 52 reales y todo sigue su curso.',
    example: 'Si calculás cosechar unas 45 alzas, declará 55 en el DT-e. Viajás seguro, no pagás de más y evitás que te rechacen el viaje en la puerta de la sala.',
    regulation: 'Reglamento Operativo API-SEM SENASA',
  },
  dteValidity: {
    title: '¿Cuánto tiempo dura un DT-e?',
    category: 'Tiempos y Vencimientos',
    body: 'El DT-e se "despierta" a las 00:00 hs del día de la carga y dura entre 2 y 4 días según la distancia del viaje. Cuando llegás a la sala, ellos lo cierran. Pero atención: si pasan los días y nadie lo cierra, el papel vence; y si pasan 4 días más de gracia sin cerrarlo, caduca y SENASA te bloquea la cuenta para sacar nuevos permisos.',
    example: 'Si tu DT-e vence el miércoles y llegaste el martes, recordale a la sala que lo cierre enseguida para que tu cuenta quede siempre limpia y habilitada.',
    regulation: 'Normativa de Caducidad y Bloqueo Preventivo SIGSA',
  },
  dteVerificationCode: {
    title: '¿Qué es el código de cierre?',
    category: 'Seguridad del Trámite',
    body: 'Es una clave secreta de seguridad que viene impresa en el papel del DT-e. Funciona como la llave de un candado: el chofer le entrega el papel a la sala al descargar las alzas, y la sala escribe esa clave en el sistema para demostrar que el camión realmente llegó a destino y nadie inventó el viaje.',
    example: 'El papel dice "Código de cierre: K9X-442". El operador de la sala lo lee del papel, lo escribe en la pantalla y presiona «Confirmar arribo».',
    regulation: 'Protocolo de Recepción Segura SITA / SENASA',
  },
  dteModes: {
    title: '¿Qué son los canales de emisión?',
    category: 'Conexión con el Estado',
    body: 'Es la forma en que ApiTrace se comunica con el gobierno. Hay tres maneras: Manual (hacés el trámite en la página de SENASA y copiás el número acá), Simulado (un modo de práctica para aprender a usar la app sin valor real ni costo) y Oficial por API (ApiTrace habla directo con las computadoras de SENASA y te da el número al instante).',
    example: 'En modo "Simulado" podés emitir 10 DT-e de prueba para practicar con los botones sin miedo a equivocarte ni pagar tasas.',
    regulation: 'Servicios Web de Integración SIGSA / AFIP',
  },
  dteDraft: {
    title: '¿Cómo funcionan los borradores automáticos?',
    category: 'Tranquilidad en la Carga',
    body: 'Cada dato que tocás o elegís se guarda solo en la memoria de tu teléfono al instante. Si se te apaga el celular, te entra una llamada o tenés que salir corriendo a atender una colmena, cuando volvés a abrir la app encontrás todo tal cual lo dejaste con el botón «Continuar».',
    example: 'Elegiste el apiario y la sala y se te acabó la batería. Cargás el teléfono, abrís ApiTrace y arriba de todo te dice: «Tenés un DT-e listo para continuar».',
    regulation: 'Persistencia Local Segura en Navegador (IndexedDB)',
  },
  slideToConfirm: {
    title: '¿Por qué hay que deslizar para confirmar?',
    category: 'Cuidado y Seguridad',
    body: 'Es como el seguro de una herramienta para no disparar acciones por error, sobre todo si estás en el campo con los dedos pegajosos de miel o usando guantes de apicultor. En vez de un simple toque que se te puede escapar sin querer, tenés que arrastrar el botón con el pulgar hasta el fondo.',
    example: 'Arrastrás el círculo de izquierda a derecha. Así te asegurás de que el trámite solo se envía a SENASA cuando estás 100% seguro de que los datos están bien.',
    regulation: 'Diseño Seguro para Interfaces Críticas (ADR-011)',
  },
  renapaApiary: {
    title: '¿Qué es el código oficial del apiario?',
    category: 'Identificación Oficial',
    body: 'Es la chapita identificatoria oficial de tus colmenas ante SENASA. Se arma con la letra de tu provincia, tu número de productor y el número de tu apiario (por ejemplo: B-12049-1). Con esa combinación no hay dos apiarios iguales en toda la Argentina: es el origen que figura en el DT-e.',
    example: '"B" es Buenos Aires, "12049" es Don Juan, y "1" es su primer apiario. Con ese código el inspector corrobora de dónde salieron las alzas.',
    regulation: 'Resolución SENASA RENAPA Federal',
  },
  senasaSala: {
    title: '¿Qué es el código SENASA de la sala?',
    category: 'Destino Habilitado',
    body: 'Es el número de matrícula nacional que tiene la extractora de miel (por ejemplo: SEF-B-20010). Demuestra que la sala fue inspeccionada por veterinarios de SENASA y que está autorizada para recibir alzas y procesar alimentos.',
    example: 'Al elegir la sala "San Andrés" en la app, el sistema busca automáticamente su código "SEF-B-20010" para ponerlo en el casillero de destino del DT-e.',
    regulation: 'Registro Nacional de Establecimientos Faenadores y Elaboradores SENASA',
  },
  delegation: {
    title: '¿Qué es delegar servicios en ARCA / AFIP?',
    category: 'Permisos Digitales',
    body: 'Es como darle un poder formal a ApiTrace, pero por internet y en dos minutos. Al delegar, le decís a la AFIP: «Le doy permiso a la aplicación ApiTrace para que tramite los DT-e en mi nombre cuando yo toque el botón en mi celular». Vos seguís siendo el dueño de todo, la app solo hace el trámite por vos sin que tengas que entrar a páginas complejas.',
    example: 'Entrás con clave fiscal a la web de ARCA, elegís el "Administrador de Relaciones", pegás la CUIT de ApiTrace y listo: ya podés emitir desde el teléfono.',
    regulation: 'Formulario F3283/E ARCA/AFIP - Administrador de Relaciones con Clave Fiscal',
  },
  transport: {
    title: '¿Qué datos se piden del vehículo?',
    category: 'El Vehículo en la Ruta',
    body: 'SENASA exige saber en qué vehículo viaja la miel: si es camioneta, camión o utilitario, y las patentes del vehículo y del acoplado si lleva. La app además te deja guardar la patente de tu camioneta habitual para que no tengas que escribirla cada vez que cosechás.',
    example: 'Camioneta Toyota Hilux, patente "AF123JK", conducida por el apicultor. La policía corrobora esos datos con la cédula verde en el control del camino.',
    regulation: 'Régimen de Transporte de Sustancias Alimenticias SENASA',
  },
  extractions: {
    title: '¿Qué es una extracción de miel?',
    category: 'En la Fábrica / Sala',
    body: 'Es el momento en que los panales llenos de miel entran a la máquina centrífuga, giran a gran velocidad y la miel líquida sale disparada hacia los filtros y tanques decantadores. Acá se separa la cera limpia por un lado y la miel pura dorada por el otro.',
    example: 'En la extracción de la mañana entraron 100 alzas con cuadros operculados y se obtuvieron 2.150 kilos de miel líquida lista para llenar tambores.',
    regulation: 'Manual de Procedimientos de Extracción de Miel SENASA',
  },
  yield: {
    title: '¿Qué es el rendimiento de extracción?',
    category: 'Cuentas Claras',
    body: 'Es la cuenta matemática que te dice cuántos kilos de miel te dio cada alza en promedio. Te ayuda a saber si la cosecha vino pesada y rendidora o si los panales vinieron con poca miel. Se calcula dividiendo los kilos totales de miel por la cantidad de alzas cosechadas.',
    example: 'Si de 50 alzas cosechadas obtuviste 1.050 kilos de miel, tu rendimiento promedio fue de 21 kilos por alza. ¡Una cosecha excelente!',
    regulation: 'Estándares de Rendimiento Apícola INTA',
  },
  lots: {
    title: '¿Qué es un lote de miel?',
    category: 'Organización y Calidad',
    body: 'Un lote es un grupo homogéneo de miel que se extrajo el mismo día o en el mismo tanque bajo idénticas condiciones. Lleva un número de lote único para que, si un comprador dice «¡Qué rica esta miel!», podamos saber exactamente qué día se extrajo y de qué flores venía.',
    example: 'El lote "LOTE-2026-A12" reúne los 4.200 kilos de miel extraídos entre el lunes y el martes provenientes de las praderas del este.',
    regulation: 'Código Alimentario Argentino, Artículo 18 bis',
  },
  lotOrigin: {
    title: '¿De qué se compone el lote?',
    category: 'La Receta de la Miel',
    body: 'Es la lista de ingredientes del lote. Especifica qué viajes de alzas y qué apiarios se mezclaron en ese tanque. Así nadie puede meter miel de procedencia dudosa o prohibida sin que quede registrado en el sistema.',
    example: 'El lote L-09 se formó con un 60% de miel del campo "La Paulina" y un 40% del campo "El Trébol", ambas analizadas y libres de medicamentos.',
    regulation: 'Norma Internacional ISO 22005 (Trazabilidad en Alimentos)',
  },
  availableQuantity: {
    title: '¿Qué es la cantidad disponible del lote?',
    category: 'Control del Tanque',
    body: 'Es la cantidad de miel que todavía te queda en el tanque esperando ser envasada en tambores o vendida. A medida que vas llenando tambores de 300 kilos, este numerito va bajando solo hasta llegar a cero.',
    example: 'Si tu lote tenía 5.000 kg y llenaste 10 tambores (3.000 kg en total), tu cantidad disponible actual es de 2.000 kg.',
    regulation: 'Sistema de Balance de Masas y Control de Inventarios',
  },
  drums: {
    title: '¿Qué es un tambor de miel?',
    category: 'Envases Gigantes',
    body: 'Es el barril metálico de 200 litros donde se guarda la miel para transportar y exportar a otros países. Por adentro está recubierto con una pintura dorada especial (epoxi sanitario) que no le transfiere ningún gusto a la miel y no se oxida jamás.',
    example: 'Un tambor lleno pesa unos 350 kilos en total: 19 kilos del tacho de chapa vacío (tara) y 331 kilos de miel pura adentro.',
    regulation: 'Resolución SAGyP N° 121/98 (Envases para Exportación de Miel)',
  },
  trace: {
    title: '¿Qué es la trazabilidad completa?',
    category: 'El Árbol Genealógico',
    body: 'Es poder contar toda la historia de la miel desde que nació en la flor hasta que llega a la tostada. Si alguien come miel argentina en Europa o Japón, gracias a la trazabilidad puede escanear la etiqueta y saber de qué colmena, qué campo y qué apicultor vino esa miel.',
    example: 'Con el número de un tambor, la app dibuja en la pantalla el camino completo: tambor → lote → extracción en sala → DT-e de la ruta → apiario → colmenas.',
    regulation: 'Ley de Trazabilidad Agroalimentaria y Reglamentación UE 178/2002',
  },
  traceGraph: {
    title: '¿Cómo leer el mapa de trazabilidad?',
    category: 'El Árbol Genealógico',
    body: 'Es un dibujo visual donde cada bolita representa un paso de la miel (el productor, el apiario, el viaje en camión, la extracción, el lote y los tambores). Las flechas te muestran cómo se fue transformando la miel paso a paso.',
    example: 'Tocás cualquier bolita del mapa y el sistema te abre una ficha con la fecha, la persona que lo hizo y los certificados sanitarios.',
    regulation: 'Mapeo Gráfico de Cadena de Custodia',
  },
  gaps: {
    title: '¿Qué es un hueco de trazabilidad?',
    category: 'Alertas y Cuidados',
    body: 'Es cuando falta un eslabón en la historia. Como si estuvieras leyendo un libro y le falta una página: por ejemplo, tenés un tambor lleno pero nadie anotó en qué sala se extrajo. El sistema te muestra un aviso en amarillo para que lo completes antes de que un auditor bloquee la miel.',
    example: 'Aviso: «El lote #04 no tiene anotado el DT-e de ingreso de alzas». Al cargar el documento que faltaba, el hueco se soluciona y queda verde.',
    regulation: 'Manual de Auditoría de Sistemas de Calidad Alimentaria',
  },
  rules: {
    title: '¿Qué son las reglas del sistema?',
    category: 'Leyes en la Computadora',
    body: 'Son las normas legales que le enseñamos a la aplicación para que conozca al detalle las resoluciones de SENASA y la Secretaría de Bioeconomía. La app las consulta sola para que vos no tengas que memorizarte leyes difíciles ni cometer errores.',
    example: 'La regla dice que el traslado de alzas a extractora exige DT-e desde agosto de 2026. Si las leyes cambian en el futuro, se actualiza la regla sin cambiar el programa.',
    regulation: 'Resoluciones Conjuntas SENASA y Secretaría de Bioeconomía',
  },
  rulePriority: {
    title: '¿Qué regla tiene prioridad?',
    category: 'Desempate de Leyes',
    body: 'A veces hay dos normas que hablan de la misma carga: una ley general y una ley especial para apicultura. En caso de duda, el sistema siempre aplica la regla más específica (la que tiene el número de prioridad más bajo).',
    example: 'La regla general dice que la miel viaja con remito, pero la regla específica dice que las alzas melarias van con DT-e. Gana la específica por tener mayor jerarquía.',
    regulation: 'Principio Jurídico de Especialidad Normativa',
  },
  audit: {
    title: '¿Qué es el libro de auditoría?',
    category: 'Seguridad Inviolable',
    body: 'Es como la caja negra de un avión o un libro de actas que nadie puede borrar ni tachar con goma. Cada vez que alguien entra a la app, guarda un dato, anula un DT-e o aprueba una recepción, la aplicación anota qué usuario fue, qué hizo y a qué hora exacta.',
    example: 'Si alguien anula un viaje por error, en el historial se lee: «Carlos anuló el DT-e el jueves a las 11:15 hs con motivo: rotura de camión». La transparencia es total.',
    regulation: 'Norma de Seguridad Informática y Ley 25.326 de Protección de Datos Personales',
  },
  pending: {
    title: '¿Qué es la cola de pendientes?',
    category: 'Sin Señal en el Campo',
    body: 'Es la bolsita donde la aplicación guarda todo lo que hacés cuando estás en medio del campo sin señal de celular ni WiFi. Podés seguir anotando colmenas o pesando tambores con total tranquilidad; cuando el teléfono vuelve al pueblo y detecta señal, envía todo solo a la nube.',
    example: 'Registraste 3 apiarios en el monte sin internet. La pantalla dice «3 operaciones esperando». Al llegar a tu casa con WiFi, se envían en dos segundos.',
    regulation: 'Almacenamiento Local Seguro en Navegador (PWA / IndexedDB)',
  },
  offline: {
    title: '¿Cómo funciona trabajar sin internet?',
    category: 'Modo Campo',
    body: 'ApiTrace está construida especialmente para el campo argentino: no necesita señal 4G para funcionar. Podés consultar tus colmenas, ver tus lotes y cargar movimientos en el monte. Lo único que necesita internet obligatorio es pedirle a SENASA el número oficial del DT-e, pero podés dejar el borrador listo y mandarlo cuando agarres señal.',
    example: 'Te vas a cosechar al medio del campo sin cobertura: la app abre al instante, no se cuelga y te deja registrar todo lo que necesitás.',
    regulation: 'Arquitectura PWA Offline-First',
  },
  idempotency: {
    title: '¿Qué es el seguro anti-duplicados?',
    category: 'Tecnología Invisible',
    body: '¿Viste cuando la señal de celular anda lenta y apretás «Guardar» tres veces seguidas por desesperación? En otros programas se te crean tres registros repetidos. En ApiTrace no: cada botón tiene una huella digital única; si se envía tres veces por mala señal, el servidor lo nota y guarda uno solo.',
    example: 'Apretás el botón con señal débil y la pantalla titila: quedate tranquilo, no se van a duplicar tus tambores ni tus viajes.',
    regulation: 'Estándar Internacional HTTP RFC 7231 (Idempotent Methods)',
  },
  dispatch: {
    title: '¿Qué es el despacho en origen?',
    category: 'Salida del Camión',
    body: 'Es el momento exacto en que las alzas o tambores se acomodan en la camioneta, se atan con las fajas de seguridad, se revisa que el chofer tenga sus papeles en mano y el vehículo sale por la tranquera hacia la ruta.',
    example: 'El apicultor anota en la app: «Salen 70 alzas en la camioneta Ford F-100 conducida por Roberto a las 08:30 hs».',
    regulation: 'Constancia de Egreso Sanitario',
  },
  reception: {
    title: '¿Qué es la recepción en destino?',
    category: 'Llegada a la Sala',
    body: 'Es cuando el vehículo llega a la extractora o galpón de acopio, se baja la compuerta y el encargado cuenta los bultos para ver que haya llegado todo sano y que coincida exactamente con lo que decía el papel de viaje.',
    example: 'El operario de la sala cuenta 68 alzas descargadas, pide el código de cierre al chofer y presiona «Aceptar recepción». El viaje quedó oficialmente cumplido.',
    regulation: 'Acta de Recepción Sanitaria SITA / SENASA',
  },
  receptionDiscrepancy: {
    title: '¿Qué pasa si llegan menos alzas o kilos a la sala?',
    category: 'Llegada a la Sala',
    body: 'Si en el viaje se rompió un cajón o el conteo dio diferente, la sala anota la cantidad real que ingresó y el motivo. No te preocupes: el sistema registra la diferencia con total claridad para que las cuentas queden transparentes entre el productor y la extractora.',
    example: 'Salieron 80 alzas pero en la sala se descargaron 78 porque 2 quedaron en el campo. Se confirma por 78 y se anota la observación sin trabar la extracción.',
    regulation: 'Acta de Discrepancia Bromatológica',
  },
  tareWeight: {
    title: '¿Qué es la tara del tambor?',
    category: 'Pesaje y Báscula',
    body: 'La tara es lo que pesa el tambor metálico vacío, con su tapa y su aro de metal (suele pesar entre 17 y 19 kilos). Para saber cuánta miel pura hay adentro, pesás el tambor lleno en la báscula y le restás la tara del tacho vacío.',
    example: 'Si el tambor con miel pesa 349 kilos en la báscula y el tambor vacío pesaba 19 kilos, adentro tenés exactamente 330 kilos de miel neta comercializable.',
    regulation: 'Ley Nacional 19.511 de Metrología Legal',
  },
  drumSeal: {
    title: '¿Qué es el precinto de seguridad?',
    category: 'Candado Inviolable',
    body: 'Es una pulserita plástica numerada irrepetible que se ajusta bien fuerte en el aro del tambor. Si alguien quisiera abrir el tambor en el camino para robar miel o agregarle agua, tendría que romper el precinto y todos se darían cuenta de inmediato.',
    example: 'El precinto rojo número "SENASA-09941" colocado al pie de la extractora garantiza que nadie tocó la miel hasta que llegó al comprador en el puerto.',
    regulation: 'Norma de Inviolabilidad de Carga Alimentaria',
  },
  honeyType: {
    title: '¿Qué es el origen botánico de la miel?',
    category: 'Sabor y Naturaleza',
    body: 'Es el tipo de flor que visitaron las abejitas para fabricar la miel. Puede ser "Multifloral" (de muchas flores silvestres mezcladas) o "Monofloral" (de una flor predominante como trébol, eucalipto, girasol o monte nativo). Cada flor le da un color, perfume y sabor diferente.',
    example: 'La miel de eucalipto es de color ámbar y sabor tostado fuerte; la miel de trébol es casi blanca, suave y muy dulce.',
    regulation: 'Código Alimentario Argentino, Artículo 782',
  },
  moisture: {
    title: '¿Por qué se mide la humedad de la miel?',
    category: 'Conservación y Calidad',
    body: 'La miel es de los pocos alimentos del mundo que no se vence nunca, ¡pero solo si tiene poquita agua! Si la miel tiene más de 18% de humedad (demasiada agua), se pueden despertar levaduras naturales y la miel se agria o fermenta. Se mide con un tubito óptico llamado refractómetro.',
    example: 'Si el refractómetro marca 17,2% de agua, la miel está en su punto perfecto de maduración: lista para envasar y durar años impecable.',
    regulation: 'Código Alimentario Argentino Art. 783 y Norma Internacional Codex Stan 12-1981',
  },
  pwa: {
    title: '¿Cómo instalar ApiTrace en tu celular?',
    category: 'Comodidad Total',
    body: 'ApiTrace no ocupa espacio en las tiendas como Google Play o App Store: la instalás directamente desde tu navegador de internet. Al tocar «Instalar aplicación» o «Agregar a pantalla principal», te queda un ícono como cualquier otra app, abre a pantalla completa y anda mucho más rápido.',
    example: 'Tocás el botón "Instalar" en el menú lateral y te aparece el loguito de la abejita en la pantalla de inicio de tu teléfono para entrar con un toque.',
    regulation: 'Estándar Web Progresivo (W3C PWA)',
  },
  settings: {
    title: '¿Qué podés hacer en Configuración?',
    category: 'A Tu Gusto',
    body: 'Acá podés personalizar cómo querés ver la aplicación: podés poner el modo oscuro (ideal para la noche o adentro del galpón) o claro (ideal bajo el sol del campo), ver si tu teléfono tiene memoria suficiente y revisar el estado de conexión con SENASA.',
    example: 'En el campo bajo sol fuerte activá el tema claro para leer los números con nitidez; en la oficina o de noche usá el modo oscuro para descansar la vista.',
    regulation: 'Opciones de Accesibilidad y Ergonomía Visual',
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
