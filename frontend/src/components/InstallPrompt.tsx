import { useEffect, useState } from 'react';
import { Button, HelpTip } from './ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Invitacion a instalar.
 *
 * Solo aparece cuando el navegador considera instalable la aplicación y emite
 * `beforeinstallprompt`. En iOS ese evento no existe, así que ahí se explica el
 * único camino disponible, y detras de un boton de ayuda para no ocupar la
 * barra con una instruccion que la mayoria ya conoce.
 */
export const InstallPrompt = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  if (deferred) {
    return (
      <Button
        size="sm"
        icon="download"
        onClick={() => {
          void deferred.prompt();
          setDeferred(null);
        }}
      >
        Instalar
      </Button>
    );
  }

  if (isIos) {
    return (
      <HelpTip
        entry={{
          title: 'Instalar en el teléfono',
          body: 'Tocá el boton Compartir del navegador y elegí «Agregar a inicio». Asi la abris como una aplicación y funciona sin conexión.',
        }}
      />
    );
  }

  return null;
};
