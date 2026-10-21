import { useLocation, useNavigate } from 'react-router-dom';
import { useResource } from '../lib/useResource';
import { DteTramite } from '../components/DteTramite';
import type { DteDraftContext } from '../lib/dteDraft';
import type { DteSummary } from '../lib/types';

/**
 * «Nuevo Trámite DT-e» a pantalla completa (doc 13). La reemisión llega desde
 * el detalle de un DT-e anulado con el traslado en el estado de la navegación.
 */
export const DteNewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reissue =
    (location.state as { reissue?: DteDraftContext & { defaults?: Record<string, string> } } | null)?.reissue ??
    null;
  const summary = useResource<DteSummary>('/dte/summary');

  const close = () => {
    // Volver a donde estaba; si entró directo (enlace, atajo de la app), a DT-e.
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) navigate(-1);
    else navigate('/dte', { replace: true });
  };

  return (
    <DteTramite
      integration={summary.data?.integration ?? null}
      blockedHolders={summary.data?.blockedHolders}
      reissue={reissue}
      onClose={close}
    />
  );
};
