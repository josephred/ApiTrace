import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Icon } from './Icon';

const HANDLE = 52;
const PAD = 3;
/** Hasta dónde hay que llevar la manija para que cuente como confirmación. */
const THRESHOLD = 0.9;

/**
 * Deslizar para confirmar.
 *
 * Viene del prototipo ApiAsistente: pedir el DT-e tiene consecuencias (genera
 * el documento oficial y su arancel) y en una camioneta un toque sin querer
 * es fácil. Deslizar la manija hasta el final es un gesto que no se hace por
 * accidente, y la barra se llena como una celda de panal mientras avanza.
 *
 * Con teclado se confirma con Enter o Espacio sobre la manija: el gesto es una
 * protección contra el toque accidental, no una barrera para quien no puede
 * arrastrar. Un toque de dedo o de mouse sobre la manija no confirma.
 */
export const SlideToConfirm = ({
  label,
  busyLabel = 'Enviando…',
  onConfirm,
  disabled,
  busy,
  disabledReason,
}: {
  label: string;
  busyLabel?: string;
  onConfirm: () => void | Promise<unknown>;
  disabled?: boolean;
  busy?: boolean;
  /** Por qué no se puede confirmar todavía; se lee debajo. */
  disabledReason?: string;
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ originX: number; max: number } | null>(null);
  const progressRef = useRef(0);
  const mounted = useRef(true);
  const [progress, setProgressState] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const setProgress = (value: number) => {
    progressRef.current = value;
    setProgressState(value);
  };

  const active = confirming || Boolean(busy);
  const locked = Boolean(disabled) || active;

  // Si el envío terminó (bien o mal) y la pantalla sigue abierta, la manija vuelve.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy && !confirming) setProgress(0);
    wasBusy.current = Boolean(busy);
  }, [busy, confirming]);

  const maxDistance = () => Math.max(1, (trackRef.current?.clientWidth ?? 0) - HANDLE - PAD * 2);

  const confirm = () => {
    if (locked) return;
    setProgress(1);
    setConfirming(true);
    const result = onConfirm();
    const settle = () => {
      if (!mounted.current) return;
      setConfirming(false);
      setProgress(0);
    };
    if (result && typeof (result as Promise<unknown>).finally === 'function') {
      // Los errores los muestra quien envia; aca solo se devuelve la manija.
      (result as Promise<unknown>).finally(settle).catch(() => undefined);
    } else {
      window.setTimeout(settle, 1200);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const max = maxDistance();
    drag.current = { originX: event.clientX - progressRef.current * max, max };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const next = (event.clientX - drag.current.originX) / drag.current.max;
    setProgress(Math.min(1, Math.max(0, next)));
  };

  const release = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    if (progressRef.current >= THRESHOLD) confirm();
    else setProgress(0);
  };

  const offset = progress * (trackRef.current ? maxDistance() : 0);
  const state = disabled ? 'disabled' : active ? 'busy' : dragging ? 'dragging' : 'idle';

  return (
    <div className="slide-wrap">
      <div
        ref={trackRef}
        className="slide"
        data-state={state}
        style={{ '--slide-fill': `${offset + HANDLE + PAD * 2}px` } as CSSProperties}
      >
        <span className="slide-fill" aria-hidden="true" />
        <span
          className="slide-label"
          aria-hidden="true"
          style={{ opacity: active ? 0 : Math.max(0, 1 - progress * 1.6) }}
        >
          {label}
        </span>
        {active && (
          <span className="slide-busy" role="status">
            <span className="spinner" aria-hidden="true" />
            {busyLabel}
          </span>
        )}
        <button
          type="button"
          className="slide-handle"
          style={{ transform: `translateX(${offset}px)` }}
          disabled={locked}
          aria-label={`${label}. Deslizá la manija hasta el final, o presioná Enter.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={release}
          onPointerCancel={release}
          onClick={(event) => {
            // Enter y Espacio generan un clic sin detalle; un toque o un clic de
            // mouse traen detail >= 1 y no deben confirmar sin deslizar.
            if (event.detail === 0) confirm();
          }}
        >
          <Icon name={active ? 'check' : 'forward'} size={22} strokeWidth={2.6} />
        </button>
      </div>
      {disabled && disabledReason && <p className="slide-reason small muted">{disabledReason}</p>}
    </div>
  );
};
