import { useCallback, useEffect, useState } from 'react';
import { apiGet } from './api';
import { toUserMessage, type UserMessage } from './errors';

export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  /** Fallo ya traducido a lenguaje humano. */
  error: UserMessage | null;
  /** true cuando el dato viene del almacenamiento local por falta de red. */
  fromCache: boolean;
  cachedAt: number | null;
  reload: () => void;
}

/**
 * Lectura de la API con respaldo local.
 *
 * Distingue tres situaciones que la interfaz debe tratar distinto: dato fresco
 * del servidor, dato viejo del cache (se muestra con advertencia) y ausencia
 * total de dato (se muestra el error). Confundirlas llevaria a presentar
 * información desactualizada como si fuera actual, que en trazabilidad es peor
 * que no mostrar nada.
 *
 * El error se guarda ya traducido: ninguna pantalla debería tener que decidir
 * cómo se le cuenta un fallo al usuario.
 */
export const useResource = <T>(path: string | null, deps: unknown[] = []): ResourceState<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<UserMessage | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiGet<T>(path)
      .then((result) => {
        if (cancelled) return;
        setData(result.data);
        setFromCache(result.fromCache);
        setCachedAt(result.cachedAt ?? null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(toUserMessage(cause));
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  return { data, loading, error, fromCache, cachedAt, reload };
};
