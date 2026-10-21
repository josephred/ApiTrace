import type { ReactNode } from 'react';
import { useResource } from '../lib/useResource';

interface MediaPayload {
  id: string;
  dataUrl: string;
  width: number | null;
  height: number | null;
}

/**
 * Foto de un maestro. Pasa por la misma capa de red que el resto (token y
 * copia local), por eso se ve también sin señal una vez que se cargó. Mientras
 * no hay foto, o si no se puede traer, muestra el `fallback`.
 */
export const MediaThumb = ({
  id,
  alt,
  fallback,
  full,
  className,
}: {
  id: string | null | undefined;
  alt: string;
  fallback: ReactNode;
  /** true: la foto completa; por defecto, la miniatura. */
  full?: boolean;
  className?: string;
}) => {
  const photo = useResource<MediaPayload>(id ? `/media/${id}${full ? '' : '/thumbnail'}` : null);
  if (!id || !photo.data) return <>{fallback}</>;
  return (
    <img
      className={className}
      src={photo.data.dataUrl}
      alt={alt}
      width={photo.data.width ?? undefined}
      height={photo.data.height ?? undefined}
      loading="lazy"
      decoding="async"
    />
  );
};
