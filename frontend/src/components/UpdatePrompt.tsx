import { useRegisterSW } from 'virtual:pwa-register/react';
import { Icon } from './Icon';
import { Button } from './ui';

/**
 * Avisos del service worker: «lista para usar sin conexión» y «hay una versión
 * nueva».
 *
 * Van en el flujo de la página, como una franja, y no flotando sobre ella. Son
 * estado del sistema, no confirmación de algo que el usuario acaba de hacer:
 * aparecen sin que nadie los pida y se quedan hasta que alguien los cierra. Un
 * aviso así, flotando, termina tapando el botón principal de la pantalla.
 *
 * La actualización se ofrece en lugar de aplicarse sola: recargar sin avisar
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
    <div
      className={needRefresh ? 'statusbar statusbar-update' : 'statusbar statusbar-ready'}
      role="status"
    >
      <Icon name={needRefresh ? 'download' : 'checkCircle'} size={16} />
      <span>
        {needRefresh
          ? 'Hay una versión nueva disponible.'
          : 'Lista para usar sin conexión desde este dispositivo.'}
      </span>
      {needRefresh && (
        <Button size="sm" variant="ghost" onClick={() => void updateServiceWorker(true)}>
          Actualizar
        </Button>
      )}
      <button
        type="button"
        className="statusbar-dismiss"
        onClick={dismiss}
        aria-label="Cerrar aviso"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
};
