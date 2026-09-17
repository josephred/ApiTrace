import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';
import { Button, HelpTip, Notice } from './ui';
import type { HELP } from '../lib/vocabulary';

/* =========================================================================
   Definicion de campos
   ========================================================================= */

export interface FieldSpec {
  name: string;
  label: string;
  type?:
    | 'text'
    | 'number'
    | 'email'
    | 'password'
    | 'tel'
    | 'date'
    | 'datetime-local'
    | 'textarea'
    | 'select';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Pista breve bajo el campo. Para explicaciones largas, usar `help`. */
  hint?: string;
  /** Tema de ayuda contextual: agrega un boton «?» junto a la etiqueta. */
  help?: keyof typeof HELP;
  step?: string;
  min?: string;
  max?: string;
  defaultValue?: string;
  full?: boolean;
  /** Teclado del telefono. Sin esto, «cantidad» abre el teclado alfabetico. */
  inputMode?: 'text' | 'decimal' | 'numeric' | 'email' | 'tel' | 'search';
  autoComplete?: string;
  /** Validacion propia. Devuelve el mensaje de error o null si esta bien. */
  validate?: (value: string, all: Record<string, string>) => string | null;
}

/* =========================================================================
   Estado del formulario
   ========================================================================= */

const requiredMessage = 'Completá este campo.';

const validateField = (
  spec: FieldSpec,
  value: string,
  all: Record<string, string>,
): string | null => {
  const trimmed = value.trim();
  if (spec.required && !trimmed) return requiredMessage;
  if (!trimmed) return null;

  if (spec.type === 'number') {
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) return 'Escribí solo números.';
    if (spec.min !== undefined && parsed < Number(spec.min))
      return `No puede ser menor que ${spec.min}.`;
    if (spec.max !== undefined && parsed > Number(spec.max))
      return `No puede ser mayor que ${spec.max}.`;
  }
  if (spec.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
    return 'Escribí un correo válido.';

  return spec.validate?.(trimmed, all) ?? null;
};

/**
 * Estado y validación de un formulario.
 *
 * Valida al salir del campo y al enviar, no en cada tecla: marcar en rojo
 * mientras alguien todavía esta escribiendo es ruido, no ayuda. Una vez que un
 * campo tiene error, se revalida al escribir para que el error desaparezca en
 * cuanto se corrige.
 */
export const useForm = (fields: FieldSpec[]) => {
  const initial = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? ''])),
    // Las especificaciones se construyen en el render; comparar por nombre alcanza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fields.map((field) => `${field.name}:${field.defaultValue ?? ''}`).join('|')],
  );

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = useCallback(
    (name: string, value: string) => {
      setValues((current) => {
        const next = { ...current, [name]: value };
        setErrors((currentErrors) => {
          if (!currentErrors[name]) return currentErrors;
          const spec = fields.find((field) => field.name === name);
          if (!spec) return currentErrors;
          const message = validateField(spec, value, next);
          if (message) return { ...currentErrors, [name]: message };
          const { [name]: _removed, ...rest } = currentErrors;
          return rest;
        });
        return next;
      });
    },
    [fields],
  );

  const blur = useCallback(
    (name: string) => {
      const spec = fields.find((field) => field.name === name);
      if (!spec) return;
      const message = validateField(spec, values[name] ?? '', values);
      setErrors((current) => {
        if (message) return { ...current, [name]: message };
        const { [name]: _removed, ...rest } = current;
        return rest;
      });
    },
    [fields, values],
  );

  /** Valida todo. Devuelve true si se puede enviar. */
  const validateAll = useCallback(
    (subset?: string[]): boolean => {
      const scope = subset ? fields.filter((field) => subset.includes(field.name)) : fields;
      const found: Record<string, string> = {};
      for (const spec of scope) {
        const message = validateField(spec, values[spec.name] ?? '', values);
        if (message) found[spec.name] = message;
      }
      setErrors((current) => ({ ...current, ...found }));
      return Object.keys(found).length === 0;
    },
    [fields, values],
  );

  const reset = useCallback(() => {
    setValues(initial);
    setErrors({});
  }, [initial]);

  return { values, setValues, set, blur, errors, setErrors, validateAll, reset };
};

/**
 * Cuerpo listo para enviar: descarta vacios y convierte numeros y fechas.
 * Estaba repetido, con variantes, en cada pantalla que enviaba un formulario.
 */
export const buildBody = (
  values: Record<string, string>,
  fields: FieldSpec[],
): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  for (const spec of fields) {
    const raw = values[spec.name];
    if (raw === undefined || raw === '') continue;
    if (spec.type === 'number') body[spec.name] = Number(raw);
    else if (spec.type === 'datetime-local' || spec.type === 'date')
      body[spec.name] = new Date(raw).toISOString();
    else body[spec.name] = raw;
  }
  return body;
};

/* =========================================================================
   Campo
   ========================================================================= */

export const Field = ({
  spec,
  value,
  error,
  onChange,
  onBlur,
}: {
  spec: FieldSpec;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) => {
  const id = `f-${spec.name}`;
  const hintId = spec.hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const shared = {
    id,
    name: spec.name,
    value,
    placeholder: spec.placeholder,
    autoComplete: spec.autoComplete,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-required': spec.required || undefined,
    'aria-describedby': [errorId, hintId].filter(Boolean).join(' ') || undefined,
    onBlur,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
  };

  return (
    <div className={spec.full ? 'field form-full' : 'field'}>
      <label className="field-label" htmlFor={id}>
        {spec.label}
        {spec.required ? (
          <>
            <span aria-hidden="true" style={{ color: 'var(--danger-fg)' }}>
              *
            </span>
            <span className="sr-only">(obligatorio)</span>
          </>
        ) : (
          <span className="field-optional">opcional</span>
        )}
        {spec.help && <HelpTip topic={spec.help} />}
      </label>

      {spec.type === 'textarea' ? (
        <textarea {...shared} rows={3} />
      ) : spec.type === 'select' ? (
        <select {...shared}>
          <option value="">Elegí una opcion</option>
          {spec.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...shared}
          type={spec.type ?? 'text'}
          step={spec.step}
          min={spec.min}
          max={spec.max}
          inputMode={spec.inputMode ?? (spec.type === 'number' ? 'decimal' : undefined)}
        />
      )}

      {error ? (
        <span className="field-error" id={errorId}>
          <Icon name="danger" size={14} />
          {error}
        </span>
      ) : (
        spec.hint && (
          <span className="field-hint" id={hintId}>
            {spec.hint}
          </span>
        )
      )}
    </div>
  );
};

/* =========================================================================
   Agrupacion
   ========================================================================= */

export const FormSection = ({ title, children }: { title?: string; children: ReactNode }) => (
  <div className="form-section">
    {title && <div className="form-section-title">{title}</div>}
    <div className="form-grid">{children}</div>
  </div>
);

/** Bloque plegado: lo que casi nadie completa no debería ocupar pantalla. */
export const Disclosure = ({
  label,
  children,
  defaultOpen,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) => (
  <details className="disclosure" open={defaultOpen}>
    <summary>
      <Icon name="forward" size={14} className="chevron" />
      {label}
    </summary>
    <div className="disclosure-body">
      <div className="form-grid">{children}</div>
    </div>
  </details>
);

/* =========================================================================
   Campos en bloque
   ========================================================================= */

export const Fields = ({
  fields,
  values,
  errors,
  onChange,
  onBlur,
}: {
  fields: FieldSpec[];
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (name: string, value: string) => void;
  onBlur?: (name: string) => void;
}) => (
  <div className="form-grid">
    {fields.map((spec) => (
      <Field
        key={spec.name}
        spec={spec}
        value={values[spec.name] ?? ''}
        error={errors[spec.name]}
        onChange={(value) => onChange(spec.name, value)}
        onBlur={onBlur ? () => onBlur(spec.name) : undefined}
      />
    ))}
  </div>
);

/* =========================================================================
   Formulario completo
   ========================================================================= */

export const Form = ({
  onSubmit,
  error,
  children,
  submitLabel,
  busyLabel,
  onCancel,
  busy,
  disabled,
  cancelLabel = 'Cancelar',
}: {
  onSubmit: (event: FormEvent) => void;
  error?: ReactNode;
  children: ReactNode;
  submitLabel: string;
  busyLabel?: string;
  onCancel?: () => void;
  busy?: boolean;
  disabled?: boolean;
  cancelLabel?: string;
}) => (
  <form onSubmit={onSubmit} noValidate>
    {error}
    {children}
    <div className="form-actions">
      {onCancel && (
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
      )}
      <Button type="submit" variant="primary" busy={busy} busyLabel={busyLabel} disabled={disabled}>
        {submitLabel}
      </Button>
    </div>
  </form>
);

/* =========================================================================
   Opciones grandes
   ========================================================================= */

export interface ChoiceOption {
  value: string;
  title: string;
  description?: string;
}

/**
 * Eleccion explicita entre pocas alternativas.
 *
 * Se usa donde antes había dos selects que el código excluia entre si pero que
 * en pantalla parecian campos independientes: acá la exclusion se ve.
 */
export const ChoiceGroup = ({
  label,
  help,
  options,
  value,
  onChange,
  multiple,
}: {
  label?: string;
  help?: keyof typeof HELP;
  options: ChoiceOption[];
  value: string | string[];
  onChange: (value: string) => void;
  multiple?: boolean;
}) => {
  const selected = (option: string) =>
    Array.isArray(value) ? value.includes(option) : value === option;

  return (
    <div style={{ marginBottom: 'var(--sp-4)' }}>
      {label && (
        <div className="field-label" style={{ marginBottom: 'var(--sp-2)' }}>
          {label}
          {help && <HelpTip topic={help} />}
        </div>
      )}
      <div className="choice-group" role={multiple ? 'group' : 'radiogroup'} aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="choice"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={selected(option.value)}
            aria-pressed={selected(option.value)}
            onClick={() => onChange(option.value)}
          >
            <span className={multiple ? 'choice-mark square' : 'choice-mark'}>
              {selected(option.value) && <Icon name="check" size={13} strokeWidth={3} />}
            </span>
            <span className="choice-text">
              <span className="choice-title">{option.title}</span>
              {option.description && <span className="choice-desc">{option.description}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

/* =========================================================================
   Asistente por pasos
   ========================================================================= */

/**
 * Indicador de progreso.
 *
 * Solo se usa donde dividir de verdad reduce la complejidad: un formulario de
 * doce campos en un telefono. Los formularios cortos siguen en un solo paso,
 * porque partirlos agregaria toques sin quitar dificultad.
 */
export const Steps = ({ names, current }: { names: string[]; current: number }) => (
  <>
    <div className="steps-counter" aria-live="polite">
      Paso {current + 1} de {names.length}: {names[current]}
    </div>
    <div className="steps">
      {names.map((name, index) => (
        <div
          key={name}
          className={`step ${index < current ? 'done' : index === current ? 'current' : ''}`}
        >
          <span className="step-bar" />
          <span className="step-name desktop-only">{name}</span>
        </div>
      ))}
    </div>
  </>
);

export const WizardActions = ({
  onBack,
  onNext,
  nextLabel,
  busy,
  busyLabel,
  submit,
  disabled,
}: {
  onBack: () => void;
  onNext?: () => void;
  nextLabel: string;
  busy?: boolean;
  busyLabel?: string;
  submit?: boolean;
  disabled?: boolean;
}) => (
  <div className="form-actions">
    <Button variant="ghost" onClick={onBack} disabled={busy} icon="back">
      Volver
    </Button>
    <Button
      type={submit ? 'submit' : 'button'}
      variant="primary"
      onClick={submit ? undefined : onNext}
      busy={busy}
      busyLabel={busyLabel}
      disabled={disabled}
    >
      {nextLabel}
    </Button>
  </div>
);

/** Aviso de error de envío, ya traducido, dentro de un formulario. */
export const FormError = ({ title, detail }: { title: string; detail?: string }) => (
  <Notice tone="danger" title={title}>
    {detail}
  </Notice>
);
