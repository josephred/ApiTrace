import { useEffect, useState } from 'react';

/**
 * Retrasa un valor hasta que deja de cambiar.
 *
 * Se usa en los buscadores: sin esto cada tecla dispara una consulta y la lista
 * parpadea mientras alguien escribe, que en una conexión de campo además gasta
 * datos para resultados que nadie va a leer.
 */
export const useDebounced = <T>(value: T, delay = 350): T => {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return settled;
};
