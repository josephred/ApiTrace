import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { HeroIcon, type HeroIconName } from './Illustrations';
import { formatPoint, getCurrentPosition, GeoError, type GeoPoint } from '../lib/geo';
import { preparePhoto, type PreparedPhoto } from '../lib/photo';
import type { Zone } from '../lib/cargo';

/**
 * Piezas de los formularios de alta del rediseño (doc 13): «Registrá un
 * nuevo apiario», «Registrá una sala…», «Registrá un nuevo transporte» y
 * «Creá tu cuenta». Cada dato va en su propia tarjeta, numerada en el orden
 * en que se completa, con el ícono a la izquierda y el campo debajo del
 * rótulo, como en las capturas de referencia.
 */

/* =========================================================================
   Encabezado del formulario
   ========================================================================= */

export const FormHero = ({
  icon,
  title,
  subtitle,
  tone = 'amber',
}: {
  icon: HeroIconName;
  title: string;
  subtitle: string;
  tone?: 'amber' | 'sky';
}) => (
  <div className={`form-hero form-hero-${tone}`}>
    <HeroIcon name={icon} tone={tone} />
    <h2 className="form-hero-title">{title}</h2>
    <p className="form-hero-sub">{subtitle}</p>
  </div>
);

/* =========================================================================
   Tarjeta de campo
   ========================================================================= */

export const FieldCard = ({
  number,
  label,
  icon,
  htmlFor,
  hint,
  error,
  trailing,
  children,
  stacked,
}: {
  number?: number;
  label: string;
  icon: IconName;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  /** Control a la derecha: botón de ubicación, contador, flecha del desplegable. */
  trailing?: ReactNode;
  children?: ReactNode;
  /** El contenido ocupa todo el ancho debajo (foto). */
  stacked?: ReactNode;
}) => {
  const errorId = useId();
  return (
    <div className={error ? 'field-card has-error' : 'field-card'}>
      <div className="field-card-row">
        <span className="field-card-icon" aria-hidden="true">
          <Icon name={icon} size={26} strokeWidth={1.9} />
        </span>
        <div className="field-card-main">
          {htmlFor ? (
            <label className="field-card-label" htmlFor={htmlFor}>
              {number ? `${number}. ` : ''}
              {label}
            </label>
          ) : (
            <span className="field-card-label">
              {number ? `${number}. ` : ''}
              {label}
            </span>
          )}
          {children}
          {hint && <span className="field-card-hint">{hint}</span>}
        </div>
        {trailing && <div className="field-card-trailing">{trailing}</div>}
      </div>
      {stacked}
      {error && (
        <span className="field-card-error" id={errorId} role="alert">
          <Icon name="danger" size={14} />
          {error}
        </span>
      )}
    </div>
  );
};

/** Campo de texto dentro de una tarjeta. */
export const TextFieldCard = ({
  number,
  label,
  icon,
  value,
  onChange,
  placeholder,
  error,
  hint,
  trailing,
  ...input
}: {
  number?: number;
  label: string;
  icon: IconName;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  hint?: ReactNode;
  trailing?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'placeholder'>) => {
  const id = useId();
  return (
    <FieldCard number={number} label={label} icon={icon} htmlFor={id} error={error} hint={hint} trailing={trailing}>
      <input
        id={id}
        className="field-card-input"
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        {...input}
      />
    </FieldCard>
  );
};

/* =========================================================================
   Ubicación
   ========================================================================= */

export const GeoField = ({
  number,
  hint,
  value,
  onChange,
  error,
  icon = 'crosshair',
}: {
  number?: number;
  /** «Registrá la ubicación de tu apiario». */
  hint: string;
  value: GeoPoint | null;
  onChange: (point: GeoPoint | null) => void;
  error?: string | null;
  /** La captura del apiario usa la mira; la de las salas, el marcador. */
  icon?: IconName;
}) => {
  const [locating, setLocating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const locate = async () => {
    setLocating(true);
    setFailure(null);
    try {
      onChange(await getCurrentPosition());
    } catch (cause) {
      setFailure(cause instanceof GeoError ? cause.message : 'No se pudo obtener la ubicación.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <FieldCard
      number={number}
      label="Obtener geolocalización"
      icon={icon}
      error={error ?? failure}
      trailing={
        <button
          type="button"
          className={value ? 'geo-button geo-button-again' : 'geo-button'}
          onClick={() => void locate()}
          disabled={locating}
          aria-busy={locating || undefined}
        >
          {locating ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <Icon name="crosshair" size={22} strokeWidth={2.2} />
          )}
          <span>{locating ? 'Buscando…' : value ? 'Actualizar' : 'Obtener ubicación'}</span>
        </button>
      }
    >
      {value ? (
        <span className="field-card-value geo-value" aria-live="polite">
          <Icon name="checkCircle" size={16} />
          <span>
            <span className="mono">{formatPoint(value.latitude, value.longitude)}</span>
            {value.accuracy !== null && <span className="geo-accuracy"> · ±{value.accuracy}&nbsp;m</span>}
          </span>
        </span>
      ) : (
        <span className="field-card-placeholder">{hint}</span>
      )}
    </FieldCard>
  );
};

/* =========================================================================
   Contador
   ========================================================================= */

export const CounterField = ({
  number,
  label,
  hint,
  icon,
  value,
  onChange,
  min = 0,
  max = 100000,
}: {
  number?: number;
  label: string;
  hint: string;
  icon: IconName;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) => {
  const id = useId();
  const clamp = (next: number) => Math.min(max, Math.max(min, Number.isFinite(next) ? next : min));
  return (
    <FieldCard
      number={number}
      label={label}
      icon={icon}
      htmlFor={id}
      trailing={
        <div className="counter-pill">
          <button
            type="button"
            className="counter-step"
            onClick={() => onChange(clamp(value - 1))}
            disabled={value <= min}
            aria-label="Una menos"
          >
            <Icon name="minus" size={22} strokeWidth={2.4} />
          </button>
          <input
            id={id}
            className="counter-value"
            inputMode="numeric"
            pattern="[0-9]*"
            value={String(value)}
            onChange={(event) => onChange(clamp(Number(event.target.value.replace(/\D/g, '') || 0)))}
            onFocus={(event) => event.target.select()}
          />
          <button
            type="button"
            className="counter-step counter-step-plus"
            onClick={() => onChange(clamp(value + 1))}
            disabled={value >= max}
            aria-label="Una más"
          >
            <Icon name="plus" size={22} strokeWidth={2.4} />
          </button>
        </div>
      }
    >
      <span className="field-card-placeholder">{hint}</span>
    </FieldCard>
  );
};

/* =========================================================================
   Foto
   ========================================================================= */

export const PhotoField = ({
  number,
  hint,
  value,
  onChange,
}: {
  number?: number;
  /** «Tomá una foto de tu apiario». */
  hint: string;
  value: PreparedPhoto | null;
  onChange: (photo: PreparedPhoto | null) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setFailure(null);
    try {
      onChange(await preparePhoto(file));
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'No se pudo usar esa foto.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <FieldCard
      number={number}
      label="Sacar foto"
      icon="camera"
      error={failure}
      stacked={
        <div className="photo-zone">
          {/*
            Sin `capture`: el teléfono ofrece cámara o galería, como dice el
            texto. Con `capture` solo abriría la cámara.
          */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => void pick(event.target.files?.[0])}
          />
          {value ? (
            <div className="photo-preview">
              <img src={value.dataUrl} alt="Foto elegida" />
              <div className="photo-preview-actions">
                <button type="button" className="chip-button" onClick={() => inputRef.current?.click()}>
                  <Icon name="camera" size={16} />
                  Cambiar
                </button>
                <button type="button" className="chip-button" onClick={() => onChange(null)}>
                  <Icon name="trash" size={16} />
                  Quitar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="photo-drop"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="camera" size={40} strokeWidth={1.9} />}
              <span>{busy ? 'Preparando la foto…' : 'Tocar para sacar foto'}</span>
            </button>
          )}
        </div>
      }
    >
      <span className="field-card-placeholder">
        {hint}
        <br />
        (o seleccioná desde la galería)
      </span>
    </FieldCard>
  );
};

/* =========================================================================
   Zona
   ========================================================================= */

const NEW_ZONE = '__nueva__';

export interface ZoneChoice {
  zoneId: string | null;
  /** Nombre de una zona nueva, que se crea al guardar el apiario. */
  zoneName: string;
}

export const ZoneField = ({
  number,
  zones,
  loading,
  value,
  onChange,
  error,
}: {
  number?: number;
  zones: Zone[];
  loading?: boolean;
  value: ZoneChoice;
  onChange: (value: ZoneChoice) => void;
  error?: string | null;
}) => {
  const id = useId();
  const newId = useId();
  const creating = value.zoneId === null && value.zoneName !== '';
  const [typing, setTyping] = useState(creating);
  const newRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typing) newRef.current?.focus();
  }, [typing]);

  const selectValue = typing ? NEW_ZONE : (value.zoneId ?? '');

  return (
    <FieldCard
      number={number}
      label="Zona"
      icon="pin"
      htmlFor={id}
      error={error}
      trailing={<Icon name="down" size={22} strokeWidth={2.4} className="zone-chevron" />}
      stacked={
        typing ? (
          <div className="zone-new">
            <label className="sr-only" htmlFor={newId}>
              Nombre de la zona nueva
            </label>
            <input
              id={newId}
              ref={newRef}
              className="field-card-input zone-new-input"
              placeholder="Nombre de la zona nueva (ej. Valle de Uco)"
              value={value.zoneName}
              maxLength={120}
              onChange={(event) => onChange({ zoneId: null, zoneName: event.target.value })}
            />
          </div>
        ) : undefined
      }
    >
      <select
        id={id}
        className="field-card-select"
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value;
          if (next === NEW_ZONE) {
            setTyping(true);
            onChange({ zoneId: null, zoneName: value.zoneName });
          } else {
            setTyping(false);
            onChange({ zoneId: next || null, zoneName: '' });
          }
        }}
      >
        <option value="">{loading ? 'Cargando zonas…' : 'Seleccioná la zona'}</option>
        {zones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.name}
            {zone.apiaryCount > 0 ? ` (${zone.apiaryCount})` : ''}
          </option>
        ))}
        <option value={NEW_ZONE}>+ Nueva zona…</option>
      </select>
    </FieldCard>
  );
};

/* =========================================================================
   Botón principal
   ========================================================================= */

export const SubmitButton = ({
  children,
  busy,
  busyLabel,
  tone = 'amber',
  disabled,
}: {
  children: ReactNode;
  busy?: boolean;
  busyLabel?: string;
  tone?: 'amber' | 'sky';
  disabled?: boolean;
}) => (
  <button
    type="submit"
    className={`submit-big submit-big-${tone}`}
    disabled={busy || disabled}
    aria-busy={busy || undefined}
  >
    {busy ? (
      <>
        <span className="spinner" aria-hidden="true" />
        {busyLabel ?? 'Guardando…'}
      </>
    ) : (
      children
    )}
  </button>
);
