import { useRegisterSW } from 'virtual:pwa-register/react';
import { Icon } from './Icon';
import { Button } from './ui';

/**
 * Aviso de versión nueva.
 *
 * La actualizacion se ofrece en lugar de aplicarse sola: recargar sin avisar
 * mientras alguien completa un formulario en el campo le haría perder lo
 * cargado.
 */
export const UpdatePrompt = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;

  const dismiss = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return (
    <div className="toast-region" role="status" aria-live="polite">
      <div className={needRefresh ? 'toast toast-info' : 'toast toast-success'}>
        <Icon name={needRefresh ? 'download' : 'checkCircle'} size={17} />
        <div className="toast-body">
          <strong>{needRefresh ? 'Hay una versión nueva' : 'Lista para usar sin conexión'}</strong>
          <div>
            {needRefresh
              ? 'Actualizá cuando termines lo que estás haciendo.'
              : 'Ya podés trabajar sin señal desde este dispositivo.'}
          </div>
          {needRefresh && (
            <div style={{ marginTop: 'var(--sp-2)' }}>
              <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>
                Actualizar ahora
              </Button>
            </div>
          )}
        </div>
        <button type="button" className="toast-close" onClick={dismiss} aria-label="Cerrar aviso">
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  );
};
