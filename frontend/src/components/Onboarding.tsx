import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { Icon, Logo, type IconName } from './Icon';
import { Button, Sheet } from './ui';
import { DelegationGuide } from './DelegationGuide';
import type { DteIntegration, UserRole } from '../lib/types';

/**
 * Introducción de primera vez.
 *
 * Viene del prototipo ApiAsistente, que abría con cuatro pantallas: qué es la
 * app, que funciona sin señal, la delegación en ARCA y «todo listo». Acá se
 * adapta al rol: al productor le cuenta el DT-e, a la sala el cierre y al
 * resto la trazabilidad. Se muestra una vez por persona en cada dispositivo y
 * se puede volver a ver desde Configuración.
 */

const SEEN_KEY = (userId: string) => `apitrace.bienvenida.${userId}`;
const REOPEN_EVENT = 'apitrace:bienvenida';

const seen = (userId: string): boolean => {
  try {
    return localStorage.getItem(SEEN_KEY(userId)) === 'vista';
  } catch {
    // Sin almacenamiento no se puede recordar: mejor no insistir en cada visita.
    return true;
  }
};

const markSeen = (userId: string) => {
  try {
    localStorage.setItem(SEEN_KEY(userId), 'vista');
  } catch {
    // Nada que hacer.
  }
};

/** Vuelve a abrir la introducción (botón de Configuración). */
export const reopenOnboarding = () => window.dispatchEvent(new Event(REOPEN_EVENT));

interface Slide {
  title: string;
  body: ReactNode;
  art: ReactNode;
}

const HexArt = ({ icon, tone = 'brand' }: { icon: IconName; tone?: 'brand' | 'success' | 'info' }) => (
  <span className={`onboard-hex onboard-hex-${tone}`} aria-hidden="true">
    <Icon name={icon} size={40} strokeWidth={1.8} />
  </span>
);

const DTE_STEPS = ['Origen y destino', 'Alzas y fechas', 'Transporte', 'Verificar y emitir'];

const slidesFor = (role: UserRole, mode: DteIntegration['mode'] | undefined, openGuide: () => void): Slide[] => {
  const issuer = role === 'PRODUCTOR';
  const receiver = role === 'SALA' || role === 'ACOPIADOR';

  const welcome: Slide = {
    title: 'Te damos la bienvenida a ApiTrace',
    body: issuer
      ? 'Acá queda registrada la historia de tu miel: de qué apiario salió, en qué sala se extrajo y en qué tambor terminó.'
      : receiver
        ? 'Acá registrás lo que llega a tu sala y lo que sale de ella, para que cada tambor tenga su origen a la vista.'
        : 'Acá se reconstruye la historia de cada producto apícola, del apiario al tambor.',
    art: (
      <span className="onboard-logo" aria-hidden="true">
        <Logo size={76} />
      </span>
    ),
  };

  const offline: Slide = {
    title: 'Funciona sin señal',
    body: 'En el monte o en la sala podés seguir cargando. Lo que registres queda en el teléfono y se envía solo cuando vuelve la conexión.',
    art: <HexArt icon="offline" tone="info" />,
  };

  if (issuer) {
    return [
      welcome,
      offline,
      {
        title: 'El DT-e en cuatro pasos',
        body: (
          <>
            <ol className="onboard-steps">
              {DTE_STEPS.map((name, index) => (
                <li key={name}>
                  <span className="onboard-step-num" aria-hidden="true">
                    {index + 1}
                  </span>
                  {name}
                </li>
              ))}
            </ol>
            <p>Si se corta a mitad de camino, lo retomás desde el Panel: se guarda solo.</p>
          </>
        ),
        art: <HexArt icon="document" />,
      },
      {
        title: 'Antes de salir',
        body: (
          <>
            <p>
              Llevá el DT-e impreso en la cabina: es el que vale en un control de ruta. Si la carga
              cambia, anulalo y emití otro antes de descargar.
            </p>
            {mode === 'sigsa' && (
              <p>
                Para que ApiTrace lo pida a SIGSA por vos, delegá el servicio en ARCA. Se hace una
                sola vez.{' '}
                <button type="button" className="link-btn" onClick={openGuide}>
                  Ver cómo se hace
                </button>
              </p>
            )}
          </>
        ),
        art: <HexArt icon="print" tone="success" />,
      },
    ];
  }

  if (receiver) {
    return [
      welcome,
      offline,
      {
        title: 'Cerrá el DT-e al descargar',
        body: 'Pedí el código de cierre impreso en el DT-e y contá las alzas. Nunca pueden ser más que las declaradas: si llegaron más, el productor tiene que emitir otro DT-e antes de descargar.',
        art: <HexArt icon="inbox" />,
      },
    ];
  }

  return [
    welcome,
    offline,
    {
      title: 'Seguí la miel en los dos sentidos',
      body: 'Desde un tambor hasta el apiario, o desde un apiario hasta sus tambores. Si falta un eslabón, ApiTrace te lo muestra en lugar de esconderlo.',
      art: <HexArt icon="trace" />,
    },
  ];
};

export const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => (user ? !seen(user.id) : false));
  const [index, setIndex] = useState(0);
  const [guide, setGuide] = useState(false);
  const dteRole = user?.role === 'PRODUCTOR' || user?.role === 'ADMIN';
  const integration = useResource<DteIntegration>(open && dteRole ? '/dte/integration' : null);

  useEffect(() => {
    const reopen = () => {
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_EVENT, reopen);
  }, []);

  const finish = useCallback(() => {
    if (user) markSeen(user.id);
    setOpen(false);
  }, [user]);

  const openGuide = useCallback(() => setGuide(true), []);
  const closeGuide = useCallback(() => setGuide(false), []);

  if (!user || !open) return null;

  const slides = slidesFor(user.role, integration.data?.mode, openGuide);
  const slide = slides[Math.min(index, slides.length - 1)];
  const last = index >= slides.length - 1;
  const issuer = user.role === 'PRODUCTOR';
  const receiver = user.role === 'SALA' || user.role === 'ACOPIADOR';

  const go = (to: string) => {
    finish();
    navigate(to);
  };

  return (
    <Sheet title="Primeros pasos" subtitle={`${index + 1} de ${slides.length}`} onClose={finish} narrow>
      <div
        className="onboard"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' && !last) setIndex((value) => value + 1);
          if (event.key === 'ArrowLeft' && index > 0) setIndex((value) => value - 1);
        }}
      >
        <div key={index} className="onboard-slide" aria-live="polite">
          <div className="onboard-art">{slide.art}</div>
          <h3 className="onboard-title">{slide.title}</h3>
          <div className="onboard-body">{typeof slide.body === 'string' ? <p>{slide.body}</p> : slide.body}</div>
        </div>

        <div className="onboard-dots" aria-hidden="true">
          {slides.map((item, dot) => (
            <span key={item.title} className={dot === index ? 'active' : undefined} />
          ))}
        </div>

        <div className="onboard-actions">
          {last ? (
            issuer ? (
              <>
                <Button variant="primary" icon="plus" block onClick={() => go('/dte?nuevo=1')}>
                  Preparar mi primer DT-e
                </Button>
                <Button variant="ghost" block onClick={finish}>
                  Ir al panel
                </Button>
              </>
            ) : receiver ? (
              <>
                <Button variant="primary" icon="inbox" block onClick={() => go('/dte?perspective=recibidos')}>
                  Ver DT-e recibidos
                </Button>
                <Button variant="ghost" block onClick={finish}>
                  Ir al panel
                </Button>
              </>
            ) : (
              <Button variant="primary" block onClick={finish}>
                Empezar
              </Button>
            )
          ) : (
            <>
              <Button variant="primary" block onClick={() => setIndex((value) => value + 1)}>
                Siguiente
              </Button>
              <div className="onboard-secondary">
                {index > 0 ? (
                  <Button variant="ghost" icon="back" onClick={() => setIndex((value) => value - 1)}>
                    Anterior
                  </Button>
                ) : (
                  <span />
                )}
                <Button variant="ghost" onClick={finish}>
                  Saltar
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
      {guide && <DelegationGuide onClose={closeGuide} />}
    </Sheet>
  );
};
