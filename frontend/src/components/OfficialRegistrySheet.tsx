import { useState, type FormEvent } from 'react';
import { apiSend } from '../lib/api';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { REGISTRATION_STATUSES, type HELP } from '../lib/vocabulary';
import { Notice, Sheet, useWriteFeedback } from './ui';
import { Fields, Form, FormError, useForm, type FieldSpec } from './Form';

export interface OfficialRegistryValue {
  code: string | null | undefined;
  status: string | null | undefined;
  validTo: string | null | undefined;
}

/**
 * Identificacion oficial de un apiario (RENAPA) o de una sala (codigo SENASA).
 *
 * Es lo que el DT-e lleva como origen y destino: sin estos codigos SIGSA no
 * emite. Mientras no haya consulta de padrones en linea, el estado lo carga la
 * persona y queda como "sin verificar" hasta que SENASA lo confirme.
 */
export const OfficialRegistrySheet = ({
  title,
  subtitle,
  path,
  entity,
  names,
  codeLabel,
  codePlaceholder,
  help,
  initial,
  onClose,
  onDone,
}: {
  title: string;
  subtitle?: string;
  /** Recurso a actualizar con PATCH, p. ej. /apiaries/:id. */
  path: string;
  /** Prefijo de cache a invalidar, p. ej. /apiaries. */
  entity: string;
  /** Nombres de las propiedades en la API. */
  names: { code: string; status: string; validTo: string };
  codeLabel: string;
  codePlaceholder: string;
  help: keyof typeof HELP;
  initial: OfficialRegistryValue;
  onClose: () => void;
  onDone: () => void;
}) => {
  const fields: FieldSpec[] = [
    {
      name: 'code',
      label: codeLabel,
      required: true,
      full: true,
      placeholder: codePlaceholder,
      help,
      defaultValue: initial.code ?? '',
    },
    {
      name: 'status',
      label: 'Estado de la habilitación',
      type: 'select',
      required: true,
      defaultValue: initial.status ?? 'PENDING_VERIFICATION',
      options: REGISTRATION_STATUSES.options,
    },
    {
      name: 'validTo',
      label: 'Vigente hasta',
      type: 'date',
      defaultValue: initial.validTo ?? '',
    },
  ];

  const { values, set, blur, errors, setErrors, validateAll } = useForm(fields);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const feedback = useWriteFeedback();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateAll()) return;
    setBusy(true);
    setFailure(null);
    try {
      // La fecha viaja como YYYY-MM-DD: es un dia de calendario, no un instante.
      const body: Record<string, unknown> = {
        [names.code]: values.code.trim(),
        [names.status]: values.status,
        ...(values.validTo ? { [names.validTo]: values.validTo } : {}),
      };
      const result = await apiSend('PATCH', path, body, {
        label: `${title} ${values.code}`,
        entity,
      });
      if (result.queued) feedback.queued('El cambio');
      else feedback.saved(`${codeLabel} guardado`, values.code.trim().toUpperCase());
      onDone();
    } catch (cause) {
      const perField = fieldErrors(cause, [names.code, names.status, names.validTo]);
      if (Object.keys(perField).length > 0) {
        setErrors({
          code: perField[names.code],
          status: perField[names.status],
          validTo: perField[names.validTo],
        });
      } else {
        const message = toUserMessage(cause, 'write');
        setFailure({ title: message.title, detail: message.detail });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={title} subtitle={subtitle} onClose={onClose} narrow>
      <Notice tone="info">
        Mientras SENASA no habilite la consulta de padrones, el estado lo cargás vos. «Sin
        verificar» no impide preparar el DT-e, pero SIGSA exige que esté habilitado.
      </Notice>
      <Form
        onSubmit={submit}
        error={failure && <FormError title={failure.title} detail={failure.detail} />}
        submitLabel="Guardar"
        busyLabel="Guardando…"
        onCancel={onClose}
        busy={busy}
      >
        <Fields fields={fields} values={values} errors={errors} onChange={set} onBlur={blur} />
      </Form>
    </Sheet>
  );
};
