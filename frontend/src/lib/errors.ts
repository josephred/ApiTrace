/**
 * Traduccion de fallos a lenguaje humano.
 *
 * La capa de red (`lib/api.ts`) devuelve el detalle tecnico del backend, que
 * sirve para diagnosticar pero no para mostrar. Aca se decide que ve la
 * persona: una frase corta que diga qué pasó y, cuando se puede, qué hacer.
 * Ningun mensaje al usuario menciona un código HTTP.
 */

import { ApiError, NetworkError } from './api';

export interface UserMessage {
  title: string;
  detail?: string;
  tone: 'danger' | 'warning' | 'info';
  /** true cuando reintentar la misma acción tiene sentido. */
  retryable: boolean;
}

/**
 * Casos del backend que merecen una redaccion propia porque el mensaje tecnico
 * no le dice nada al usuario o, peor, lo confunde.
 */
const KNOWN: { match: RegExp; message: UserMessage }[] = [
  {
    match: /no tiene una organizaci[oó]n asignada|sin organizaci[oó]n/i,
    message: {
      title: 'Tu usuario todavía no puede operar',
      detail: 'No tiene una organización asignada. Pedile a un administrador que te asigne una.',
      tone: 'warning',
      retryable: false,
    },
  },
  {
    match: /credenciales|invalid credentials|contrase(n|ñ)a incorrecta/i,
    message: {
      title: 'Correo o contraseña incorrectos',
      detail: 'Revisá los datos e intentá de nuevo.',
      tone: 'danger',
      retryable: true,
    },
  },
  {
    match: /already exists|ya existe|duplicate|duplicad/i,
    message: {
      title: 'Ese registro ya existe',
      detail: 'Revisá el código o el número: puede estar cargado con otro nombre.',
      tone: 'warning',
      retryable: false,
    },
  },
  {
    match: /requires document|requiere documento|sin dt-?e/i,
    message: {
      title: 'Falta el documento del traslado',
      detail: 'Registrá el DT-e antes de despachar este movimiento.',
      tone: 'warning',
      retryable: false,
    },
  },
  {
    match: /already consumed|ya fue procesad|ya consumid|ya se proces/i,
    message: {
      title: 'Ese movimiento ya se procesó',
      detail: 'Un movimiento recibido solo puede alimentar una extracción.',
      tone: 'warning',
      retryable: false,
    },
  },
  {
    match: /exceeds|excede|supera la cantidad|insufficient|insuficiente/i,
    message: {
      title: 'La cantidad no cierra',
      detail: 'Revisá el número: no puede superar lo disponible.',
      tone: 'warning',
      retryable: false,
    },
  },
  {
    match: /invalid state|estado inv[aá]lido|transition/i,
    message: {
      title: 'Esa acción no corresponde ahora',
      detail: 'El estado del registro cambió. Actualizá la pantalla y volvé a intentar.',
      tone: 'warning',
      retryable: true,
    },
  },
];

const BY_STATUS: Record<number, UserMessage> = {
  400: {
    title: 'Falta revisar algún dato',
    detail: 'Fijate en los campos marcados.',
    tone: 'warning',
    retryable: false,
  },
  401: {
    title: 'Tu sesión venció',
    detail: 'Volvé a iniciar sesión para continuar.',
    tone: 'warning',
    retryable: false,
  },
  403: {
    title: 'No tenés permiso para esto',
    detail: 'Tu rol no habilita esta acción.',
    tone: 'warning',
    retryable: false,
  },
  404: {
    title: 'No encontramos ese registro',
    detail: 'Puede haber sido eliminado o el enlace estar desactualizado.',
    tone: 'warning',
    retryable: false,
  },
  409: {
    title: 'Hay un conflicto con otro registro',
    detail: 'Alguien pudo haber modificado esto mientras trabajabas.',
    tone: 'warning',
    retryable: true,
  },
  422: {
    title: 'Falta revisar algún dato',
    detail: 'Fijate en los campos marcados.',
    tone: 'warning',
    retryable: false,
  },
  429: {
    title: 'Demasiados intentos seguidos',
    detail: 'Esperá un momento y volvé a intentar.',
    tone: 'warning',
    retryable: true,
  },
  500: {
    title: 'No pudimos completar la operación',
    detail: 'Fue un problema nuestro. Probá de nuevo en un momento.',
    tone: 'danger',
    retryable: true,
  },
  502: {
    title: 'El servidor no responde',
    detail: 'Probá de nuevo en un momento.',
    tone: 'danger',
    retryable: true,
  },
  503: {
    title: 'El servicio está en mantenimiento',
    detail: 'Probá de nuevo en unos minutos.',
    tone: 'danger',
    retryable: true,
  },
};

/** Sin red al escribir: la operación no se pierde, se encola. */
const OFFLINE_WRITE: UserMessage = {
  title: 'Sin conexión',
  detail: 'Guardamos la operación en el teléfono y la enviamos cuando vuelva la señal.',
  tone: 'info',
  retryable: true,
};

/** Sin red al leer y sin copia local: no hay nada que mostrar. */
const OFFLINE_READ: UserMessage = {
  title: 'Sin conexión y sin copia local',
  detail: 'Estos datos nunca se descargaron en este dispositivo. Volvé a intentar con señal.',
  tone: 'warning',
  retryable: true,
};

const UNKNOWN: UserMessage = {
  title: 'Algo salió mal',
  detail: 'Probá de nuevo. Si vuelve a pasar, avisale a un administrador.',
  tone: 'danger',
  retryable: true,
};

const CODE_MESSAGES: Record<string, UserMessage> = {
  EXCESO_CANTIDAD_DECLARADA: {
    title: 'La cantidad recibida supera la declarada',
    detail: 'No podés recibir más alzas o tambores de los declarados en el DT-e oficial. Verificá el conteo físico.',
    tone: 'danger',
    retryable: false,
  },
  DTE_NO_VIGENTE: {
    title: 'El DT-e no está vigente',
    detail: 'El documento está fuera de su período de validez o en un estado que no autoriza el tránsito.',
    tone: 'danger',
    retryable: false,
  },
  DTE_TRANSITO_EXPIRADO: {
    title: 'Plazo de tránsito expirado',
    detail: 'El DT-e superó las 72 horas desde la salida sin confirmación de arribo en la sala.',
    tone: 'danger',
    retryable: false,
  },
  CODIGO_VERIFICACION_INVALIDO: {
    title: 'Código de verificación incorrecto',
    detail: 'El código ingresado no coincide con el emitido oficialmente por SENASA.',
    tone: 'danger',
    retryable: true,
  },
  DTE_NO_CERRADO: {
    title: 'El DT-e debe estar cerrado',
    detail: 'La sala de extracción debe confirmar la recepción y cerrar el DT-e antes de iniciar el extractado.',
    tone: 'warning',
    retryable: false,
  },
  TRANSITO_NO_AUTORIZADO: {
    title: 'Tránsito no autorizado',
    detail: 'El semáforo o estado del DT-e no autoriza el despacho en este momento.',
    tone: 'danger',
    retryable: false,
  },
  ORGANIZACION_NO_AUTORIZADA: {
    title: 'Operación no permitida para tu organización',
    detail: 'Solo la organización titular o el receptor autorizado pueden realizar esta acción.',
    tone: 'warning',
    retryable: false,
  },
  DTE_YA_CERRADO: {
    title: 'El DT-e ya fue cerrado',
    detail: 'Este documento sanitario ya completó su ciclo de vida.',
    tone: 'info',
    retryable: false,
  },
  DTE_NO_ANULABLE: {
    title: 'No se puede anular el DT-e',
    detail: 'El documento ya está en tránsito o fue cerrado en destino.',
    tone: 'warning',
    retryable: false,
  },
  FALTA_DELEGACION_SENASA: {
    title: 'Falta delegación de servicios SENASA',
    detail: 'El CUIT del productor debe delegar el servicio en AFIP/ARCA a ApiTrace.',
    tone: 'warning',
    retryable: false,
  },
};

/**
 * Convierte cualquier fallo en algo que se pueda mostrar tal cual.
 *
 * `kind` importa solo para la falta de red: al escribir, la operación queda en
 * cola y no se pierde nada; al leer, simplemente no hay dato que mostrar. Decir
 * lo mismo en los dos casos confundiria a quien trabaja sin senal.
 */
export const toUserMessage = (cause: unknown, kind: 'read' | 'write' = 'read'): UserMessage => {
  if (cause instanceof NetworkError) return kind === 'write' ? OFFLINE_WRITE : OFFLINE_READ;

  if (cause instanceof ApiError) {
    if (cause.code && CODE_MESSAGES[cause.code]) {
      return CODE_MESSAGES[cause.code];
    }

    const text = String(cause.message ?? '');
    const known = KNOWN.find((entry) => entry.match.test(text));
    if (known) return known.message;

    const byStatus = BY_STATUS[cause.status];
    if (byStatus) {
      // Con 400/422 el backend suele explicar bien qué campo falla; ese detalle
      // es más útil que el texto generico, siempre que no sea un volcado tecnico.
      if ((cause.status === 400 || cause.status === 422) && isReadable(text)) {
        return { ...byStatus, detail: capitalize(text) };
      }
      return byStatus;
    }

    if (isReadable(text)) {
      return { title: capitalize(text), tone: 'warning', retryable: false };
    }
  }

  return UNKNOWN;
};

/** Versión de una linea, para lugares donde no entra un titulo y un detalle. */
export const toUserText = (cause: unknown, kind: 'read' | 'write' = 'read'): string => {
  const message = toUserMessage(cause, kind);
  return message.detail ? `${message.title}. ${message.detail}` : message.title;
};

/**
 * Reparte los mensajes de validación del backend por campo.
 *
 * NestJS devuelve `message` como lista de frases que empiezan con el nombre de
 * la propiedad («quantity must be a positive number»). Asociarlas a su campo
 * permite mostrar el error al lado del control que lo causo en vez de en un
 * cartel arriba del formulario, que obliga a buscar cual fue.
 */
export const fieldErrors = (cause: unknown, knownFields: string[]): Record<string, string> => {
  if (!(cause instanceof ApiError)) return {};
  const detail = cause.detail as { message?: unknown } | null;
  const raw = detail?.message;
  const lines = Array.isArray(raw) ? raw.map(String) : [];
  const out: Record<string, string> = {};

  for (const line of lines) {
    const field = knownFields.find(
      (name) => line.startsWith(`${name} `) || line.startsWith(`${name}.`),
    );
    if (field && !out[field]) out[field] = translateValidation(line, field);
  }
  return out;
};

/** Frases de class-validator a castellano corto. */
const translateValidation = (line: string, field: string): string => {
  const rest = line.slice(field.length).trim();
  const rules: [RegExp, string][] = [
    [/should not be empty|must not be empty|is required/i, 'Completá este campo.'],
    [/must be a (positive )?number|must be a number/i, 'Tiene que ser un número.'],
    [/must be a positive/i, 'Tiene que ser mayor que cero.'],
    [/must be an email/i, 'Escribí un correo válido.'],
    [/must be a valid (ISO ?8601 )?date|must be a Date/i, 'Elegí una fecha válida.'],
    [/must be a UUID/i, 'El identificador no es válido.'],
    [/must be longer than or equal to (\d+)/i, 'Es demasiado corto.'],
    [/must be shorter than or equal to (\d+)/i, 'Es demasiado largo.'],
    [/must be one of/i, 'Elegí una de las opciones.'],
    [/must not be less than (\d+)/i, 'El valor es demasiado bajo.'],
    [/must not be greater than (\d+)/i, 'El valor es demasiado alto.'],
  ];
  for (const [pattern, message] of rules) {
    if (pattern.test(rest)) return message;
  }
  return 'Revisá este dato.';
};

/** Descarta volcados tecnicos que no deberian llegar a la pantalla. */
const isReadable = (text: string): boolean =>
  Boolean(text) &&
  text.length < 180 &&
  !/^[A-Z][a-z]+Error\b/.test(text) &&
  !/\bat\s+\w+\s*\(/.test(text) &&
  !/^(Internal Server Error|Bad Request|Forbidden|Unauthorized|Not Found)$/i.test(text);

const capitalize = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);
