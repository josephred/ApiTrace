import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * Almacenamiento local del modo offline.
 *
 * Se usa IndexedDB y no el cache del service worker para las respuestas de la
 * API por una razon concreta: hace falta acceso estructurado a los datos para
 * mezclar lo que ya vino del servidor con lo que todavia espera en la cola de
 * envio. Un cache de respuestas HTTP no permite eso.
 */

export interface CachedResponse {
  key: string;
  data: unknown;
  cachedAt: number;
}

export type OutboxStatus = 'PENDING' | 'SENDING' | 'FAILED' | 'DONE';

export interface OutboxItem {
  id: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body: unknown;
  /** Generada en el cliente al encolar: un reintento nunca duplica la operacion. */
  idempotencyKey: string;
  /** Texto legible para mostrar en la cola, p. ej. "Movimiento a Sala San Andres". */
  label: string;
  /** Entidad afectada, para invalidar el cache correcto al sincronizar. */
  entity: string;
  createdAt: number;
  attempts: number;
  status: OutboxStatus;
  lastError?: string;
  lastAttemptAt?: number;
}

interface ApiTraceDB extends DBSchema {
  cache: {
    key: string;
    value: CachedResponse;
  };
  outbox: {
    key: string;
    value: OutboxItem;
    indexes: { 'by-status': OutboxStatus; 'by-created': number };
  };
  meta: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'apitrace';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ApiTraceDB>> | null = null;

export const getDb = (): Promise<IDBPDatabase<ApiTraceDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<ApiTraceDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const store = db.createObjectStore('outbox', { keyPath: 'id' });
          store.createIndex('by-status', 'status');
          store.createIndex('by-created', 'createdAt');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
};

// --------------------------------------------------------------------------
// Cache de lecturas
// --------------------------------------------------------------------------

export const putCache = async (key: string, data: unknown): Promise<void> => {
  const db = await getDb();
  await db.put('cache', { key, data, cachedAt: Date.now() });
};

export const readCache = async <T>(key: string): Promise<{ data: T; cachedAt: number } | null> => {
  const db = await getDb();
  const record = await db.get('cache', key);
  return record ? { data: record.data as T, cachedAt: record.cachedAt } : null;
};

/** Invalida por prefijo: al crear un movimiento caducan todos sus listados. */
export const invalidateCache = async (prefix: string): Promise<void> => {
  const db = await getDb();
  const tx = db.transaction('cache', 'readwrite');
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.key.toString().startsWith(prefix)) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
};

export const clearCache = async (): Promise<void> => {
  const db = await getDb();
  await db.clear('cache');
};

// --------------------------------------------------------------------------
// Cola de escrituras
// --------------------------------------------------------------------------

export const enqueue = async (
  item: Omit<OutboxItem, 'id' | 'createdAt' | 'attempts' | 'status'>,
): Promise<OutboxItem> => {
  const db = await getDb();
  const record: OutboxItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    attempts: 0,
    status: 'PENDING',
  };
  await db.put('outbox', record);
  return record;
};

/** Devuelve la cola en orden de llegada: el orden importa para la trazabilidad. */
export const listOutbox = async (): Promise<OutboxItem[]> => {
  const db = await getDb();
  const items = await db.getAll('outbox');
  return items.sort((a, b) => a.createdAt - b.createdAt);
};

export const countPending = async (): Promise<number> => {
  const items = await listOutbox();
  return items.filter((item) => item.status === 'PENDING' || item.status === 'FAILED').length;
};

export const updateOutbox = async (id: string, patch: Partial<OutboxItem>): Promise<void> => {
  const db = await getDb();
  const current = await db.get('outbox', id);
  if (!current) return;
  await db.put('outbox', { ...current, ...patch });
};

export const removeOutbox = async (id: string): Promise<void> => {
  const db = await getDb();
  await db.delete('outbox', id);
};

export const clearOutbox = async (): Promise<void> => {
  const db = await getDb();
  await db.clear('outbox');
};

// --------------------------------------------------------------------------
// Metadatos
// --------------------------------------------------------------------------

export const setMeta = async (key: string, value: unknown): Promise<void> => {
  const db = await getDb();
  await db.put('meta', value, key);
};

export const getMeta = async <T>(key: string): Promise<T | undefined> => {
  const db = await getDb();
  return (await db.get('meta', key)) as T | undefined;
};

/** Borra todo lo local. Se usa al cerrar sesion para no dejar datos de otro usuario. */
export const wipeLocalData = async (): Promise<void> => {
  const db = await getDb();
  await Promise.all([db.clear('cache'), db.clear('outbox'), db.clear('meta')]);
};
