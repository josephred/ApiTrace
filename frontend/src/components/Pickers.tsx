import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { HelpTip } from './ui';
import type { HELP } from '../lib/vocabulary';

/**
 * Controles «de dedo grande» traídos del prototipo ApiAsistente.
 *
 * En el campo, con guantes o con el sol de frente, elegir de una lista
 * desplegable o escribir un número con el teclado del teléfono es donde se
 * equivoca la gente. Estos controles convierten cada pregunta en algo que se
 * toca: tarjetas para elegir, un contador con + y − para cantidades, y
 * atajos para los valores de siempre.
 */

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const Required = ({ required }: { required?: boolean }) =>
  required ? (
    <>
      <span aria-hidden="true" style={{ color: 'var(--danger-fg)' }}>
        *
      </span>
      <span className="sr-only">(obligatorio)</span>
    </>
  ) : (
    <span className="field-optional">opcional</span>
  );

/* =========================================================================
   Tarjetas para elegir una opción
   ========================================================================= */

export interface PickOption {
  value: string;
  title: string;
  /** Segunda línea: nombre, ubicación, organización. */
  subtitle?: ReactNode;
  /** Código oficial (RENAPA, código SENASA): va en monoespaciada. Si falta, lo dice `warning`. */
  code?: string | null;
  /** Estado del registro oficial (por ejemplo, un StatusPill). */
  status?: ReactNode;
  /** Lo que impide usarla para el trámite, dicho en una línea. */
  warning?: string | null;
  /** La eligió la última vez: va primera y lo dice. */
  recent?: boolean;
  /** Texto adicional para el buscador. */
  searchText?: string;
}

export const PickCards = ({
  label,
  help,
  required,
  icon,
  options,
  value,
  onChange,
  error,
  empty,
  columns = 1,
}: {
  label: string;
  help?: keyof typeof HELP;
  required?: boolean;
  icon: IconName;
  options: PickOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Qué mostrar si no hay ninguna opción para elegir. */
  empty?: ReactNode;
  columns?: 1 | 2;
}) => {
  const id = useId();
  const [query, setQuery] = useState('');
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // La opción usada la última vez va primera: casi siempre se repite.
  const sorted = useMemo(
    () => [...options].sort((a, b) => Number(Boolean(b.recent)) - Number(Boolean(a.recent))),
    [options],
  );
  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return sorted;
    return sorted.filter((option) =>
      normalize(`${option.title} ${option.code ?? ''} ${option.searchText ?? ''}`).includes(needle),
    );
  }, [sorted, query]);

  const selectedIndex = filtered.findIndex((option) => option.value === value);
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0;
  const errorId = error ? `${id}-error` : undefined;

  /** Flechas para recorrer, como en un grupo de radios nativo. */
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
    const backward = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
    if (!forward && !backward) return;
    event.preventDefault();
    const next = (index + (forward ? 1 : -1) + filtered.length) % filtered.length;
    refs.current[next]?.focus();
    onChange(filtered[next].value);
  };

  return (
    <div className="pick-field">
      <div className="field-label" id={`${id}-label`}>
        {label}
        <Required required={required} />
        {help && <HelpTip topic={help} />}
      </div>

      {options.length > 6 && (
        <div className="search-wrap pick-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre o código"
            aria-label={`Buscar en ${label.toLowerCase()}`}
          />
        </div>
      )}

      {options.length === 0 ? (
        empty
      ) : filtered.length === 0 ? (
        <p className="small muted">Nada coincide con «{query}».</p>
      ) : (
        <div
          role="radiogroup"
          aria-labelledby={`${id}-label`}
          aria-describedby={errorId}
          aria-invalid={error ? true : undefined}
          className={columns === 2 ? 'pick-grid pick-cols-2' : 'pick-grid'}
        >
          {filtered.map((option, index) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                ref={(element) => {
                  refs.current[index] = element;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={index === tabStop ? 0 : -1}
                className={['pick', selected ? 'selected' : '', option.warning ? 'has-warning' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onChange(option.value)}
                onKeyDown={(event) => onKey(event, index)}
              >
                <span className="pick-icon" aria-hidden="true">
                  <Icon name={icon} size={20} />
                </span>
                <span className="pick-body">
                  <span className="pick-title">{option.title}</span>
                  {option.subtitle && <span className="pick-sub">{option.subtitle}</span>}
                  {(option.code || option.status || option.recent) && (
                    <span className="pick-meta">
                      {option.code && <span className="pick-code mono">{option.code}</span>}
                      {option.status}
                      {option.recent && <span className="pick-recent">La última vez</span>}
                    </span>
                  )}
                  {option.warning && (
                    <span className="pick-warn">
                      <Icon name="warning" size={13} />
                      {option.warning}
                    </span>
                  )}
                </span>
                <span className="pick-check" aria-hidden="true">
                  <Icon name="check" size={13} strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <span className="field-error" id={errorId}>
          <Icon name="danger" size={14} />
          {error}
        </span>
      )}
    </div>
  );
};

/* =========================================================================
   Atajos
   ========================================================================= */

export const Chips = ({
  label,
  options,
  value,
  onChange,
}: {
  /** Nombre del grupo para lectores de pantalla. */
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="chips" role="group" aria-label={label}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        className="chip"
        aria-pressed={option.value === value}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);

/* =========================================================================
   Contador
   ========================================================================= */

/**
 * Cantidad grande con − y +. Se puede escribir igual: el contador ayuda, no
 * obliga. Los atajos llevan directo a los valores habituales de una carga.
 */
export const QuantityStepper = ({
  id,
  label,
  value,
  onChange,
  onBlur,
  min = 1,
  max = 100000,
  unit = 'alzas',
  presets,
  hint,
  help,
  error,
  required,
  tone = 'default',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  min?: number;
  max?: number;
  unit?: string;
  presets?: number[];
  hint?: ReactNode;
  help?: keyof typeof HELP;
  error?: string;
  required?: boolean;
  /** `strong` destaca la cifra que va al documento. */
  tone?: 'default' | 'strong';
}) => {
  const current = Number(value) || 0;
  const clamp = (next: number) => String(Math.min(max, Math.max(min, next)));
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="field qty-field">
      <label className="field-label" htmlFor={id}>
        {label}
        <Required required={required} />
        {help && <HelpTip topic={help} />}
      </label>
      <div className={tone === 'strong' ? 'qty qty-strong' : 'qty'}>
        <button
          type="button"
          className="qty-btn"
          onClick={() => onChange(clamp(current - 1))}
          disabled={current <= min}
          aria-label={`Una menos: ${label.toLowerCase()}`}
        >
          <Icon name="minus" size={22} />
        </button>
        <div className="qty-value">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            // El ancho sigue a la cifra para que número y unidad queden juntos y centrados.
            style={{ width: `${Math.max(1, value.length) + 0.6}ch` }}
            value={value}
            placeholder="0"
            onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
            onBlur={onBlur}
            aria-invalid={error ? true : undefined}
            aria-required={required || undefined}
            aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          />
          <span className="qty-unit" aria-hidden="true">
            {unit}
          </span>
        </div>
        <button
          type="button"
          className="qty-btn"
          onClick={() => onChange(clamp(current + 1))}
          disabled={current >= max}
          aria-label={`Una más: ${label.toLowerCase()}`}
        >
          <Icon name="plus" size={22} />
        </button>
      </div>
      {presets && presets.length > 0 && (
        <Chips
          label={`Atajos: ${label.toLowerCase()}`}
          options={presets.map((preset) => ({ value: String(preset), label: String(preset) }))}
          value={value}
          onChange={onChange}
        />
      )}
      {error ? (
        <span className="field-error" id={errorId}>
          <Icon name="danger" size={14} />
          {error}
        </span>
      ) : (
        hint && (
          <span className="field-hint" id={hintId}>
            {hint}
          </span>
        )
      )}
    </div>
  );
};
