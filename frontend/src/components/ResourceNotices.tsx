import { formatRelative } from '../lib/format';
import type { UserMessage } from '../lib/errors';
import { ErrorNotice, Notice } from './ui';

interface Resource {
  fromCache: boolean;
  cachedAt: number | null;
  error: UserMessage | null;
  reload: () => void;
}

/**
 * Los dos avisos que toda pantalla de datos necesita, con una sola redaccion.
 *
 * Antes cada página escribia su propia versión del mismo hecho —«Datos locales
 * guardados hace 5 min», «…Sin conexión al servidor», «…Podés seguir
 * consultando»— y el usuario leia tres mensajes distintos para una sola
 * situacion. Un solo componente evita que vuelvan a divergir.
 */
export const ResourceNotices = ({ resource }: { resource: Resource }) => (
  <>
    {resource.fromCache && (
      <Notice tone="warning" title="Estas viendo una copia local">
        Guardada {formatRelative(resource.cachedAt)}. Se actualiza sola al recuperar la conexión.
      </Notice>
    )}
    {resource.error && <ErrorNotice message={resource.error} onRetry={resource.reload} />}
  </>
);
