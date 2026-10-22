import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { HELP, statusInfo, type HelpEntry, type Tone } from '../lib/vocabulary';
import { useHelpSettings } from '../lib/helpContext';

/* =========================================================================
   Botones
   ========================================================================= */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: IconName;
  block?: boolean;
  /** Mientras es true el boton se deshabilita y cambia de texto. */
  busy?: boolean;
  /** Texto durante el envio. Por defecto, el del boton con puntos suspensivos. */
  busyLabel?: string;
}

/**
 * Un boton dice en que estado esta: «Guardar» pasa a «Guardando…» y se
 * deshabilita, de modo que nadie tenga que adivinar si el toque registro.
 */
export const Button = ({
  variant = 'secondary',
  size = 'md',
  icon,
  block,
  busy,
  busyLabel,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) => (
  <button
    type={type}
    className={[
      'btn',
      `btn-${variant}`,
      size === 'sm' ? 'btn-sm' : '',
      block ? 'btn-block' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    disabled={disabled || busy}
    aria-busy={busy || undefined}
    {...rest}
  >
    {busy ? (
      <>
        <span className="spinner" aria-hidden="true" />
        {busyLabel ?? (typeof children === 'string' ? `${children}…` : 'Enviando…')}
      </>
    ) : (
      <>
        {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
        {children}
      </>
    )}
  </button>
);

export const ButtonLink = ({
  to,
  variant = 'secondary',
  size = 'md',
  icon,
  block,
  children,
}: {
  to: string;
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: IconName;
  block?: boolean;
  children: ReactNode;
}) => (
  <Link
    to={to}
    className={['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', block ? 'btn-block' : '']
      .filter(Boolean)
      .join(' ')}
  >
    {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
    {children}
  </Link>
);

/* =========================================================================
   Ayuda contextual
   ========================================================================= */

/**
 * Boton «?».
 *
 * Reemplaza los parrafos de definicion que antes ocupaban el encabezado de
 * cada pantalla de forma permanente. La explicacion existe, pero solo aparece
 * cuando alguien la pide.
 */
/**
 * Boton «?».
 *
 * Reemplaza los parrafos de definicion que antes ocupaban el encabezado de
 * cada pantalla de forma permanente. La explicacion existe, pero solo aparece
 * cuando alguien la pide.
 *
 * En dispositivos moviles (<640px) se abre como una Hoja Modal Inferior (Bottom Sheet),
 * evitando desbordes o cortes en los bordes de la pantalla.
 * En escritorio se abre como un popover anclado con limites seguros de viewport.
 */
export const HelpTip = ({ topic, entry }: { topic?: keyof typeof HELP; entry?: HelpEntry }) => {
  const { helpEnabled, setHelpEnabled } = useHelpSettings();
  const content = entry ?? (topic ? HELP[topic] : undefined);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );
  const [desktopCoords, setDesktopCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 360,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Detección responsive para alternar entre Bottom Sheet (móvil) y Popover anclado (escritorio)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 639px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Calcular posición segura para el popover en escritorio (clamping estricto de viewport)
  const updatePosition = useCallback(() => {
    if (!buttonRef.current || isMobile) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 32);

    // Ajuste horizontal: asegurarse de que no se corte por izquierda ni derecha
    let left = rect.left;
    if (left + width > window.innerWidth - 16) {
      left = window.innerWidth - width - 16;
    }
    if (left < 16) {
      left = 16;
    }

    // Ajuste vertical: colocar abajo; si sobrepasa el viewport inferior y cabe arriba, invertir
    const estHeight = 280;
    let top = rect.bottom + 8;
    if (top + estHeight > window.innerHeight - 16 && rect.top - estHeight > 16) {
      top = Math.max(16, rect.top - 8 - estHeight);
    }

    setDesktopCoords({ top, left, width });
  }, [isMobile]);

  useEffect(() => {
    if (!open) return;

    if (!isMobile) {
      updatePosition();
      const onResizeOrScroll = () => updatePosition();
      window.addEventListener('resize', onResizeOrScroll);
      window.addEventListener('scroll', onResizeOrScroll, true);
      return () => {
        window.removeEventListener('resize', onResizeOrScroll);
        window.removeEventListener('scroll', onResizeOrScroll, true);
      };
    } else {
      // Bloquear scroll de la página de fondo mientras la hoja esté abierta en móvil
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [open, isMobile, updatePosition]);

  // Manejo de teclado (Escape cierra y devuelve foco) y clics fuera
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    const onDown = (event: MouseEvent) => {
      if (isMobile) return; // En móvil el backdrop overlay captura el clic
      const target = event.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, isMobile]);

  const handleClose = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  if (!helpEnabled || !content) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="help-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? titleId : undefined}
        aria-label={`Ayuda: ${content.title}`}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>

      {open && typeof document !== 'undefined' &&
        createPortal(
          isMobile ? (
            /* ==================== MÓVIL: HOJA INFERIOR (BOTTOM SHEET MODAL) ==================== */
            <div
              className="help-overlay"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) handleClose();
              }}
            >
              <div
                ref={popoverRef}
                className="help-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
              >
                <div className="help-sheet-grip" aria-hidden="true" />
                <div className="help-sheet-header">
                  {content.category ? (
                    <span className="help-pop-badge">{content.category}</span>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    className="help-pop-close"
                    aria-label="Cerrar ayuda"
                    onClick={handleClose}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>

                <div className="help-sheet-body-scroll">
                  <h2 id={titleId} className="help-sheet-title">
                    {content.title}
                  </h2>
                  <div className="help-sheet-desc">{content.body}</div>

                  {content.example && (
                    <div className="help-pop-example">
                      <span className="help-pop-example-tag">
                        <Icon name="sparkles" size={12} />
                        <span>Ejemplo de uso</span>
                      </span>
                      <p className="help-pop-example-text">{content.example}</p>
                    </div>
                  )}

                  {content.regulation && (
                    <div className="help-pop-regulation">
                      <span className="help-pop-regulation-icon" aria-hidden="true">
                        📜
                      </span>
                      <span>{content.regulation}</span>
                    </div>
                  )}

                  <div className="help-sheet-actions">
                    <button
                      type="button"
                      className="help-sheet-understand-btn"
                      onClick={handleClose}
                    >
                      Entendido
                    </button>
                    <div className="help-pop-footer" style={{ justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="help-pop-disable-btn"
                        onClick={() => {
                          setHelpEnabled(false);
                          handleClose();
                        }}
                        title="Ocultar todos los botones de ayuda contextual (?)"
                      >
                        Desactivar ayudas contextuales
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ==================== ESCRITORIO: POPOVER CLAMPED CON PORTAL ==================== */
            <div
              ref={popoverRef}
              id={titleId}
              role="dialog"
              aria-modal="false"
              className="help-pop help-pop-portal"
              style={{
                top: desktopCoords.top,
                left: desktopCoords.left,
                width: desktopCoords.width,
              }}
            >
              <div className="help-pop-top">
                {content.category ? (
                  <span className="help-pop-badge">{content.category}</span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className="help-pop-close"
                  aria-label="Cerrar ayuda"
                  onClick={handleClose}
                >
                  <Icon name="close" size={14} />
                </button>
              </div>

              <div className="help-pop-title">{content.title}</div>
              <div className="help-pop-body">{content.body}</div>

              {content.example && (
                <div className="help-pop-example">
                  <span className="help-pop-example-tag">
                    <Icon name="sparkles" size={12} />
                    <span>Ejemplo de uso</span>
                  </span>
                  <p className="help-pop-example-text">{content.example}</p>
                </div>
              )}

              {content.regulation && (
                <div className="help-pop-regulation">
                  <span className="help-pop-regulation-icon" aria-hidden="true">
                    📜
                  </span>
                  <span>{content.regulation}</span>
                </div>
              )}

              <div className="help-pop-footer">
                <button
                  type="button"
                  className="help-pop-disable-btn"
                  onClick={() => {
                    setHelpEnabled(false);
                    handleClose();
                  }}
                  title="Ocultar todos los botones de ayuda contextual (?)"
                >
                  Desactivar ayudas contextuales
                </button>
              </div>
            </div>
          ),
          document.body,
        )}
    </>
  );
};

/* =========================================================================
   Encabezado de página
   ========================================================================= */

export const PageHeader = ({
  title,
  code,
  status,
  sub,
  help,
  back,
  actions,
}: {
  title: string;
  code?: string;
  status?: ReactNode;
  sub?: ReactNode;
  help?: keyof typeof HELP;
  /** Camino de vuelta: en movil es la única forma visible de volver. */
  back?: { to: string; label: string };
  actions?: ReactNode;
}) => (
  <div className="page-head">
    {back && (
      <Link to={back.to} className="back-link">
        <Icon name="back" size={16} />
        {back.label}
      </Link>
    )}
    <div className="page-head-top">
      <div className="grow">
        <div className="page-title-row">
          <h1>{title}</h1>
          {status}
          {help && <HelpTip topic={help} />}
        </div>
        {code && <div className="page-code">{code}</div>}
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions}
    </div>
  </div>
);

/* =========================================================================
   Tarjetas y cifras
   ========================================================================= */

export const Card = ({
  title,
  help,
  actions,
  children,
  flush,
}: {
  title?: ReactNode;
  help?: keyof typeof HELP;
  actions?: ReactNode;
  children: ReactNode;
  /** Sin relleno: para listas que llegan hasta el borde. */
  flush?: boolean;
}) => (
  <section className="card">
    {(title || actions) && (
      <header className="card-head">
        <div className="row row-tight">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {help && <HelpTip topic={help} />}
        </div>
        {actions && <div className="row">{actions}</div>}
      </header>
    )}
    <div className={flush ? 'card-body flush' : 'card-body'}>{children}</div>
  </section>
);

export const Stat = ({
  label,
  value,
  hint,
  help,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  help?: keyof typeof HELP;
}) => (
  <div className="card stat">
    <div className="stat-label row row-tight">
      {label}
      {help && <HelpTip topic={help} />}
    </div>
    <div className="stat-value">{value}</div>
    {hint && <div className="stat-hint">{hint}</div>}
  </div>
);

/* =========================================================================
   Sellos de estado
   ========================================================================= */

const TONE_ICON: Record<Tone, IconName | null> = {
  success: 'checkCircle',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  brand: null,
  neutral: null,
};

export const Pill = ({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
}) => (
  <span className={tone === 'neutral' ? 'pill' : `pill pill-${tone}`}>
    {icon && <Icon name={icon} size={13} />}
    {children}
  </span>
);

/**
 * Estado del dominio traducido. Lleva icono además de color, para que la
 * severidad no dependa solo del color.
 */
export const StatusPill = ({
  status,
  withIcon = true,
}: {
  status: string | null | undefined;
  withIcon?: boolean;
}) => {
  const info = statusInfo(status);
  const icon = withIcon ? TONE_ICON[info.tone] : null;
  return (
    <span className={info.tone === 'neutral' ? 'pill' : `pill pill-${info.tone}`}>
      {icon && <Icon name={icon} size={13} />}
      {info.label}
    </span>
  );
};

/* =========================================================================
   Avisos
   ========================================================================= */

export const Notice = ({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) => (
  <div className={`notice notice-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
    <Icon
      name={tone === 'success' ? 'checkCircle' : tone === 'info' ? 'info' : tone === 'warning' ? 'warning' : 'danger'}
      size={17}
    />
    <div className="notice-body">
      {title && <div className="notice-title">{title}</div>}
      {children}
      {action && <div style={{ marginTop: 'var(--sp-3)' }}>{action}</div>}
    </div>
  </div>
);

/** Aviso de fallo ya traducido a lenguaje humano. */
export const ErrorNotice = ({
  message,
  onRetry,
}: {
  message: { title: string; detail?: string; tone: 'danger' | 'warning' | 'info'; retryable: boolean };
  onRetry?: () => void;
}) => (
  <Notice
    tone={message.tone}
    title={message.title}
    action={
      message.retryable && onRetry ? (
        <Button size="sm" icon="sync" onClick={onRetry}>
          Reintentar
        </Button>
      ) : undefined
    }
  >
    {message.detail}
  </Notice>
);

/* =========================================================================
   Estados vacios y de carga
   ========================================================================= */

export const EmptyState = ({
  icon = 'inbox',
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="empty">
    <div className="empty-icon">
      <Icon name={icon} size={24} />
    </div>
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {action}
  </div>
);

export const Spinner = ({ label }: { label?: string }) => (
  <span className="row row-tight small muted" role="status">
    <span className="spinner" aria-hidden="true" />
    {label ?? 'Cargando…'}
  </span>
);

export const Skeleton = ({ width = '100%', height = 14 }: { width?: string | number; height?: number }) => (
  <span className="skeleton" style={{ width, height, display: 'block' }} aria-hidden="true" />
);

/** Silueta con la forma de una lista, para que la pantalla no parezca trabada. */
export const SkeletonList = ({ rows = 5 }: { rows?: number }) => (
  <div aria-hidden="true">
    {Array.from({ length: rows }, (_, index) => (
      <div className="skeleton-row" key={index}>
        <Skeleton width="30%" />
        <Skeleton width="22%" />
        <Skeleton width="18%" />
      </div>
    ))}
    <span className="sr-only" role="status">
      Cargando…
    </span>
  </div>
);

/* =========================================================================
   Hoja: diálogo en escritorio, panel inferior en movil
   ========================================================================= */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Sheet = ({
  title,
  subtitle,
  help,
  onClose,
  children,
  narrow,
}: {
  title: string;
  subtitle?: ReactNode;
  help?: keyof typeof HELP;
  onClose: () => void;
  children: ReactNode;
  narrow?: boolean;
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  /**
   * El foco entra al abrir, queda atrapado adentro y vuelve al control que
   * abrio la hoja al cerrarse. Sin esto, quien navega con teclado o lector de
   * pantalla sigue recorriendo la página de atrás sin saber que hay un dialogo.
   */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (event: KeyboardEvent) => {
      // Con otra hoja abierta encima (por ejemplo, una guía dentro de un
      // asistente), el teclado es de la de arriba: Escape cierra solo esa.
      if (panel?.querySelector('.overlay')) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null,
      );
      if (items.length === 0) return;

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={narrow ? 'sheet sheet-narrow' : 'sheet'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="sheet-grip" />
        <header className="sheet-head">
          <div className="grow">
            <div className="row row-tight" style={{ alignItems: 'center' }}>
              <h2 id={titleId}>{title}</h2>
              {help && <HelpTip topic={help} />}
            </div>
            {subtitle && <div className="sheet-sub">{subtitle}</div>}
          </div>
          <Button variant="ghost" className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </Button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
};

/* =========================================================================
   Confirmacion de acciones importantes
   ========================================================================= */

/**
 * Reemplaza `window.confirm`, que no se puede redactar ni traducir y aparece
 * con los botones del sistema operativo. Aca la consecuencia se dice explicita
 * y el boton lleva el verbo de la acción, no un «Aceptar» generico.
 */
export const ConfirmDialog = ({
  title,
  description,
  confirmLabel,
  tone = 'danger',
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <Sheet title={title} onClose={onCancel} narrow>
    <div className="small" style={{ color: 'var(--text-2)' }}>
      {description}
    </div>
    <div className="form-actions">
      <Button variant="ghost" onClick={onCancel} disabled={busy}>
        Cancelar
      </Button>
      <Button
        variant={tone === 'danger' ? 'danger-solid' : 'primary'}
        onClick={onConfirm}
        busy={busy}
        busyLabel="Un momento…"
      >
        {confirmLabel}
      </Button>
    </div>
  </Sheet>
);

/* =========================================================================
   Avisos flotantes
   ========================================================================= */

interface ToastInput {
  tone?: 'success' | 'info' | 'warning' | 'danger';
  title: string;
  detail?: ReactNode;
  /** Enlace opcional, p. ej. «Ver la cola» tras encolar una operacion. */
  action?: { label: string; to: string };
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<((input: ToastInput) => void) | null>(null);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = ++counter.current;
      setItems((current) => [...current.slice(-2), { ...input, id }]);
      // Los avisos con acción duran más: hay algo que leer y decidir.
      const life = input.action ? 9000 : 5000;
      window.setTimeout(() => dismiss(id), life);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.tone ?? 'success'}`}>
            <Icon
              name={
                item.tone === 'danger'
                  ? 'danger'
                  : item.tone === 'warning'
                    ? 'warning'
                    : item.tone === 'info'
                      ? 'info'
                      : 'checkCircle'
              }
              size={17}
            />
            <div className="toast-body">
              <strong>{item.title}</strong>
              {item.detail && <div>{item.detail}</div>}
              {item.action && (
                <div style={{ marginTop: 'var(--sp-1)' }}>
                  <Link to={item.action.to} onClick={() => dismiss(item.id)}>
                    {item.action.label}
                  </Link>
                </div>
              )}
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(item.id)}
              aria-label="Cerrar aviso"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const push = useContext(ToastContext);
  if (!push) throw new Error('useToast debe usarse dentro de ToastProvider.');
  return push;
};

/** Traduce el resultado de una escritura en el aviso que corresponde. */
export const useWriteFeedback = () => {
  const toast = useToast();
  return useMemo(
    () => ({
      saved: (title: string, detail?: string) => toast({ tone: 'success', title, detail }),
      queued: (what: string) =>
        toast({
          tone: 'info',
          title: 'Guardado en el dispositivo',
          detail: `${what} se enviará al recuperar la señal.`,
          action: { label: 'Ver pendientes', to: '/pending' },
        }),
    }),
    [toast],
  );
};

/* =========================================================================
   Lista de definiciones
   ========================================================================= */

export const SummaryList = ({ rows }: { rows: { key: string; value: ReactNode }[] }) => (
  <dl className="summary-list">
    {rows.map((row) => (
      <div className="summary-row" key={row.key}>
        <dt>{row.key}</dt>
        <dd>{row.value}</dd>
      </div>
    ))}
  </dl>
);
