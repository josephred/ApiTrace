import type { ReactNode } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { SyncBar } from './Layout';
import { UpdatePrompt } from './UpdatePrompt';

/**
 * Barra superior de las pantallas del rediseño: flecha (o cruz) y título,
 * como en las capturas de referencia («← Nuevo Apiario», «✕ Nuevo Trámite
 * DT-e»). En el teléfono es la única forma visible de volver.
 */
export const AppBar = ({
  title,
  back,
  close,
  onBack,
  actions,
}: {
  title: string;
  /** Ruta a la que vuelve la flecha. Si falta, vuelve en el historial. */
  back?: string;
  /** Cruz en lugar de flecha (el asistente). */
  close?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
}) => {
  const navigate = useNavigate();
  const goBack = () => {
    if (onBack) return onBack();
    if (back) return navigate(back);
    if (window.history.length > 1) return navigate(-1);
    return navigate('/');
  };
  return (
    <header className="app-bar">
      <button
        type="button"
        className="app-bar-back"
        onClick={goBack}
        aria-label={close ? 'Cerrar' : 'Volver'}
      >
        <Icon name={close ? 'close' : 'arrowLeft'} size={24} strokeWidth={2.2} />
      </button>
      <h1 className="app-bar-title">{title}</h1>
      {actions && <div className="app-bar-actions">{actions}</div>}
    </header>
  );
};

/**
 * Pantallas de foco (formularios de alta y asistente del DT-e): sin barra
 * inferior ni lateral, como en las capturas. La barra de estado de la
 * sincronización sigue arriba, porque lo que se guarda sin señal importa acá
 * más que en ningún otro lado.
 */
export const FocusLayout = () => (
  <div className="focus-app">
    <SyncBar />
    <UpdatePrompt />
    <main className="focus-main" id="contenido">
      <Outlet />
    </main>
  </div>
);
