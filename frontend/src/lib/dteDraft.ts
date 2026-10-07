import { useCallback, useEffect, useState } from 'react';
import { deleteMeta, getMeta, setMeta } from './db';

/**
 * El DT-e a medio armar, guardado en el dispositivo.
 *
 * En el campo el teléfono se apaga, la app se cierra o entra una llamada a
 * mitad del asistente. Perder lo cargado obliga a empezar de cero con las
 * manos ocupadas, y es la razón por la que se abandona el trámite. Acá se
 * guarda cada cambio del asistente y se ofrece retomarlo desde el panel.
 *
 * Vive en el almacén `meta` de IndexedDB: se borra solo al cerrar sesión,
 * igual que el resto de lo local, para no dejar datos de un usuario a otro.
 */

/** Cuando el DT-e reemplaza a otro del mismo traslado (anulado o rechazado). */
export interface DteDraftContext {
  movementId: string;
  movementCode: string;
  origin: string;
  destination: string;
  /** Número del DT-e que se reemplaza, si tenía. */
  replaces: string | null;
  /** Por qué se dio de baja el anterior: orienta qué corregir. */
  reason?: string | null;
}

export interface DteDraft {
  version: 1;
  userId: string;
  step: number;
  values: Record<string, string>;
  context: DteDraftContext | null;
  savedAt: number;
}

/** Lo último que la persona eligió, para ofrecerlo primero la próxima vez. */
export interface RecentPicks {
  apiaryId?: string;
  destinationEstablishmentId?: string;
}

const DRAFT_KEY = (userId: string) => `dteDraft:${userId}`;
const PICKS_KEY = (userId: string) => `dteRecent:${userId}`;
const CHANGED = 'apitrace:dte-draft';

const announce = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED));
};

/** Campos que, completos, hacen que valga la pena ofrecer retomar el borrador. */
const MEANINGFUL = ['apiaryId', 'destinationEstablishmentId', 'estimatedQuantity', 'declaredQuantity'];

export const isMeaningfulDraft = (
  values: Record<string, string>,
  context: DteDraftContext | null,
): boolean => Boolean(context) || MEANINGFUL.some((name) => Boolean(values[name]?.trim()));

export const loadDteDraft = async (userId: string): Promise<DteDraft | null> => {
  try {
    const draft = await getMeta<DteDraft>(DRAFT_KEY(userId));
    return draft && draft.version === 1 && draft.userId === userId ? draft : null;
  } catch {
    return null;
  }
};

export const saveDteDraft = async (draft: Omit<DteDraft, 'version' | 'savedAt'>): Promise<void> => {
  try {
    await setMeta(DRAFT_KEY(draft.userId), { ...draft, version: 1, savedAt: Date.now() });
    announce();
  } catch {
    // Sin almacenamiento el asistente funciona igual; solo no se puede retomar.
  }
};

export const clearDteDraft = async (userId: string): Promise<void> => {
  try {
    await deleteMeta(DRAFT_KEY(userId));
    announce();
  } catch {
    // Nada que limpiar.
  }
};

export const loadRecentPicks = async (userId: string): Promise<RecentPicks> => {
  try {
    return (await getMeta<RecentPicks>(PICKS_KEY(userId))) ?? {};
  } catch {
    return {};
  }
};

export const saveRecentPicks = async (userId: string, picks: RecentPicks): Promise<void> => {
  try {
    await setMeta(PICKS_KEY(userId), picks);
  } catch {
    // Es una comodidad: si no se guarda, la próxima vez no se ordena.
  }
};

/**
 * El borrador guardado del usuario, actualizado cuando el asistente lo cambia
 * desde otra pantalla. Lo usan los avisos «Tenés un DT-e a medio armar».
 */
export const useDteDraft = (userId: string | null | undefined) => {
  const [draft, setDraft] = useState<DteDraft | null>(null);

  const reload = useCallback(async () => {
    setDraft(userId ? await loadDteDraft(userId) : null);
  }, [userId]);

  useEffect(() => {
    void reload();
    window.addEventListener(CHANGED, reload);
    return () => window.removeEventListener(CHANGED, reload);
  }, [reload]);

  const discard = useCallback(async () => {
    if (userId) await clearDteDraft(userId);
  }, [userId]);

  return { draft, discard, reload };
};

/** Nombre corto del paso para el aviso del borrador. */
export const DRAFT_STEP_NAMES = ['origen y destino', 'alzas y fechas', 'transporte', 'verificación'];
