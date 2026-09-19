import { apiBaseUrl } from './config';
import {
  enqueue,
  invalidateCache,
  putCache,
  readCache,
  type OutboxItem,
} from './db';

/** Error de la API con el detalle que devuelve el backend. */
export class ApiError extends Error {
  readonly code?: string;

  constructor(
    readonly status: number,
    message: string,
    readonly detail?: unknown,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    if (detail && typeof detail === 'object' && 'code' in detail && typeof (detail as { code?: unknown }).code === 'string') {
      this.code = (detail as { code: string }).code;
    }
  }
}

/** Fallo de red: la peticion nunca llego al servidor. Es lo que dispara la cola. */
export class NetworkError extends Error {
  constructor(message = 'Sin conexión con el servidor.') {
    super(message);
    this.name = 'NetworkError';
  }
}

// --------------------------------------------------------------------------
// Sesión
// --------------------------------------------------------------------------

interface TokenBundle {
  accessToken: string;
  refreshToken: string;
}

/**
 * Los tokens los administra AuthProvider; la capa de API solo los lee a traves
 * de estos ganchos. Evita una dependencia circular entre modulos y permite
 * probar la capa de red sin montar React.
 */
let tokens: TokenBundle | null = null;
let onTokensRefreshed: ((next: TokenBundle) => void) | null = null;
let onSessionExpired: (() => void) | null = null;

export const setTokens = (next: TokenBundle | null): void => {
  tokens = next;
};

export const configureAuthHooks = (hooks: {
  onTokensRefreshed: (next: TokenBundle) => void;
  onSessionExpired: () => void;
}): void => {
  onTokensRefreshed = hooks.onTokensRefreshed;
  onSessionExpired = hooks.onSessionExpired;
};

// --------------------------------------------------------------------------
// Peticion base
// --------------------------------------------------------------------------

interface RawOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  signal?: AbortSignal;
}

const parseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const rawRequest = async (path: string, options: RawOptions = {}): Promise<Response> => {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && tokens?.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  try {
    return await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch {
    // fetch solo rechaza por fallo de red o cancelacion: nunca por status HTTP.
    throw new NetworkError();
  }
};

let refreshInFlight: Promise<boolean> | null = null;

/** Renueva el access token. Una sola renovacion en vuelo, aunque fallen varias peticiones a la vez. */
const refreshSession = async (): Promise<boolean> => {
  if (!tokens?.refreshToken) return false;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await rawRequest('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: tokens?.refreshToken },
        auth: false,
      });
      if (!response.ok) return false;
      const payload = (await parseBody(response)) as TokenBundle;
      tokens = { accessToken: payload.accessToken, refreshToken: payload.refreshToken };
      onTokensRefreshed?.(tokens);
      return true;
    } catch {
      // Sin red no se puede renovar; el modo offline sigue sirviendo del cache.
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
};

const request = async (path: string, options: RawOptions = {}): Promise<Response> => {
  let response = await rawRequest(path, options);

  if (response.status === 401 && options.auth !== false && tokens?.refreshToken) {
    if (await refreshSession()) {
      response = await rawRequest(path, options);
    } else {
      onSessionExpired?.();
    }
  }
  return response;
};

const toApiError = async (response: Response): Promise<ApiError> => {
  const detail = (await parseBody(response)) as { message?: unknown } | null;
  const raw = detail?.message;
  const message = Array.isArray(raw) ? raw.join(' ') : ((raw as string) ?? response.statusText);
  return new ApiError(
    response.status,
    message || `Error ${response.status}`,
    detail,
    response.headers.get('x-correlation-id') ?? undefined,
  );
};

// --------------------------------------------------------------------------
// Lecturas con respaldo en cache
// --------------------------------------------------------------------------

export interface ReadResult<T> {
  data: T;
  /** true si el dato salio del almacenamiento local y no del servidor. */
  fromCache: boolean;
  cachedAt?: number;
}

/**
 * Estrategia red primero con respaldo en cache.
 *
 * Se prefiere el servidor porque la trazabilidad debe reflejar el estado real;
 * el cache es la red de seguridad para el apiario sin cobertura, no la fuente
 * habitual. Cuando responde del cache lo dice, para que la interfaz pueda
 * advertirlo en lugar de mostrar datos viejos como si fueran frescos.
 */
export const apiGet = async <T>(path: string, options: { cache?: boolean } = {}): Promise<ReadResult<T>> => {
  const useCache = options.cache !== false;

  try {
    const response = await request(path);
    if (!response.ok) throw await toApiError(response);
    const data = (await parseBody(response)) as T;
    if (useCache) await putCache(path, data);
    return { data, fromCache: false };
  } catch (error) {
    if (error instanceof NetworkError && useCache) {
      const cached = await readCache<T>(path);
      if (cached) return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
    }
    throw error;
  }
};

// --------------------------------------------------------------------------
// Escrituras con cola offline
// --------------------------------------------------------------------------

export interface WriteOptions {
  /** Texto legible de la operación, para mostrar en la cola de pendientes. */
  label: string;
  /** Prefijo de cache a invalidar tras el envío, p. ej. "/movements". */
  entity: string;
  /** false para operaciones que no tienen sentido diferidas (login, por ejemplo). */
  queueOffline?: boolean;
}

export type WriteResult<T> =
  | { queued: false; data: T }
  | { queued: true; item: OutboxItem };

/**
 * Envia una escritura. Si no hay red, la encola en lugar de fallar.
 *
 * Cada operación lleva una `Idempotency-Key` generada en el cliente y guardada
 * junto al pedido: el reintento posterior usa exactamente la misma clave, de
 * modo que un movimiento nunca se duplica aunque el envío original si haya
 * llegado al servidor y solo se haya perdido la respuesta.
 */
export const apiSend = async <T>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body: unknown,
  options: WriteOptions,
): Promise<WriteResult<T>> => {
  const idempotencyKey = crypto.randomUUID();
  const queueOffline = options.queueOffline !== false;

  if (queueOffline && !navigator.onLine) {
    const item = await enqueue({
      method,
      path,
      body,
      idempotencyKey,
      label: options.label,
      entity: options.entity,
    });
    return { queued: true, item };
  }

  try {
    const response = await request(path, {
      method,
      body,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    if (!response.ok) throw await toApiError(response);
    const data = (await parseBody(response)) as T;
    await invalidateCache(options.entity);
    return { queued: false, data };
  } catch (error) {
    if (error instanceof NetworkError && queueOffline) {
      const item = await enqueue({
        method,
        path,
        body,
        idempotencyKey,
        label: options.label,
        entity: options.entity,
      });
      return { queued: true, item };
    }
    throw error;
  }
};

/** Reenvia un elemento de la cola conservando su clave de idempotencia original. */
export const replayOutboxItem = async (item: OutboxItem): Promise<unknown> => {
  const response = await request(item.path, {
    method: item.method,
    body: item.body,
    headers: { 'Idempotency-Key': item.idempotencyKey },
  });
  if (!response.ok) throw await toApiError(response);
  await invalidateCache(item.entity);
  return parseBody(response);
};

// --------------------------------------------------------------------------
// Autenticacion (sin cola: iniciar sesión offline no tiene sentido)
// --------------------------------------------------------------------------

export const apiLogin = async <T>(email: string, password: string): Promise<T> => {
  const response = await rawRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  if (!response.ok) throw await toApiError(response);
  return (await parseBody(response)) as T;
};

export const apiLogout = async (refreshToken: string): Promise<void> => {
  try {
    await rawRequest('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false });
  } catch {
    // Cerrar sesión sin red es valido: la sesión local se descarta igual.
  }
};

export const buildQuery = (params: Record<string, string | number | undefined | null>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
};
