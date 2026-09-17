import { useState, type FormEvent } from 'react';
import { apiSend } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { toUserMessage } from '../lib/errors';
import { formatDateTime, formatQuantity, toLocalInput } from '../lib/format';
import { MATERIAL_TYPES } from '../lib/vocabulary';
import {
  Button,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  Sheet,
  SkeletonList,
  StatusPill,
  SummaryList,
  useWriteFeedback,
} from '../components/ui';
import { DataList, type Column } from '../components/DataList';
import { ResourceNotices } from '../components/ResourceNotices';
import {
  ChoiceGroup,
  Field,
  Fields,
  FormError,
  Steps,
  WizardActions,
  useForm,
  type FieldSpec,
} from '../components/Form';
import type { Establishment, Extraction, Movement, Paginated } from '../lib/types';

/* =========================================================================
   Listado
   ========================================================================= */

export const ExtractionsPage = () => {
  const { canWrite } = useAuth();
  const [creating, setCreating] = useState(false);
  const [pageSize, setPageSize] = useState(25);

  const list = useResource<Paginated<Extraction>>(`/extractions?pageSize=${pageSize}`);
  const salas = useResource<Paginated<Establishment>>(
    '/establishments?pageSize=100&type=SALA_EXTRACCION',
  );

  const yieldOf = (extraction: Extraction): string => {
    const input = Number(extraction.inputQuantity);
    const output = extraction.outputQuantity ? Number(extraction.outputQuantity) : null;
    return output && input ? `${((output / input) * 100).toFixed(1)} %` : '—';
  };

  const columns: Column<Extraction>[] = [
    {
      key: 'code',
      header: 'Código',
      role: 'title',
      cell: (item) => <strong className="mono">{item.code}</strong>,
    },
    {
      key: 'status',
      header: 'Estado',
      role: 'status',
      cell: (item) => <StatusPill status={item.status} />,
    },
    {
      key: 'started',
      header: 'Inicio',
      cell: (item) => <span className="nowrap">{formatDateTime(item.startedAt)}</span>,
    },
    {
      key: 'input',
      header: 'Ingreso',
      align: 'right',
      cell: (item) => formatQuantity(item.inputQuantity, item.unit),
    },
    {
      key: 'output',
      header: 'Obtenido',
      align: 'right',
      cell: (item) => formatQuantity(item.outputQuantity, item.unit),
    },
    { key: 'yield', header: 'Rendimiento', align: 'right', cell: yieldOf },
  ];

  return (
    <div className="stack">
      <PageHeader
        title="Extracciones"
        help="extractions"
        actions={
          canWrite && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Nueva extracción
            </Button>
          )
        }
      />

      <ResourceNotices resource={list} />

      <Card flush>
        <DataList
          items={list.data?.data ?? []}
          columns={columns}
          rowKey={(item) => item.id}
          loading={list.loading}
          total={list.data?.meta.total}
          onLoadMore={() => setPageSize((size) => size + 25)}
          loadingMore={list.loading}
          empty={
            <EmptyState
              icon="extractions"
              title="Todavía no hay extracciones"
              description="Primero hay que registrar la recepción de un movimiento en la sala. Recien entonces puede procesarse."
              action={
                canWrite && (
                  <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                    Nueva extracción
                  </Button>
                )
              }
            />
          }
        />
      </Card>

      {creating && (
        <NewExtractionWizard
          salas={salas.data?.data ?? []}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            list.reload();
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   Asistente de alta
   ========================================================================= */

const STEP_NAMES = ['Qué se procesa', 'Datos del proceso'];

const PROCESS_FIELDS = (): FieldSpec[] => [
  {
    name: 'startedAt',
    label: 'Inicio',
    type: 'datetime-local',
    required: true,
    defaultValue: toLocalInput(),
  },
  { name: 'finishedAt', label: 'Fin', type: 'datetime-local' },
  { name: 'operatorName', label: 'Operario' },
];

const NewExtractionWizard = ({
  salas,
  onClose,
  onDone,
}: {
  salas: Establishment[];
  onClose: () => void;
  onDone: () => void;
}) => {
  const [step, setStep] = useState(0);
  const [establishmentId, setEstablishmentId] = useState(salas.length === 1 ? salas[0].id : '');
  const [selected, setSelected] = useState<string[]>([]);
  const [outputQuantity, setOutputQuantity] = useState('');
  const [outputError, setOutputError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const feedback = useWriteFeedback();

  const processFields = PROCESS_FIELDS();
  const { values, set, blur, errors, validateAll } = useForm(processFields);

  /** Solo los movimientos ya recibidos y no consumidos por otra extraccion. */
  const available = useResource<Movement[]>(
    establishmentId ? `/lots/available-inputs/${establishmentId}` : null,
  );

  const options = available.data ?? [];
  const chosen = options.filter((movement) => selected.includes(movement.id));
  const totalInput = chosen.reduce((sum, movement) => sum + Number(movement.quantity), 0);
  const unit = chosen[0]?.unit ?? 'KG';

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const next = () => {
    if (!establishmentId) {
      setStepError('Elegí la sala donde se hace la extracción.');
      return;
    }
    if (chosen.length === 0) {
      setStepError('Elegí al menos un movimiento recibido para procesar.');
      return;
    }
    setStepError(null);
    setStep(1);
  };

  const checkOutput = (value: string): boolean => {
    if (!value) return true;
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) {
      setOutputError('Escribí una cantidad valida.');
      return false;
    }
    if (parsed > totalInput) {
      setOutputError(`No puede superar lo que entró (${formatQuantity(totalInput, unit)}).`);
      return false;
    }
    setOutputError(null);
    return true;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateAll() || !checkOutput(outputQuantity)) return;

    setBusy(true);
    setFailure(null);
    try {
      const body: Record<string, unknown> = {
        establishmentId,
        startedAt: new Date(values.startedAt).toISOString(),
        inputs: chosen.map((movement) => ({
          movementId: movement.id,
          quantity: Number(movement.quantity),
          unit: movement.unit,
        })),
      };
      if (values.finishedAt) body.finishedAt = new Date(values.finishedAt).toISOString();
      if (values.operatorName) body.operatorName = values.operatorName;
      if (outputQuantity) body.outputQuantity = Number(outputQuantity);

      const result = await apiSend<Extraction>('POST', '/extractions', body, {
        label: `Extracción de ${chosen.length} movimiento(s)`,
        entity: '/extractions',
      });
      if (result.queued) feedback.queued('La extracción');
      else feedback.saved('Extracción registrada', result.data.code);
      onDone();
    } catch (cause) {
      const message = toUserMessage(cause, 'write');
      setFailure({ title: message.title, detail: message.detail });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Nueva extracción" onClose={onClose}>
      <Steps names={STEP_NAMES} current={step} />

      <form onSubmit={submit} noValidate>
        {failure && <FormError title={failure.title} detail={failure.detail} />}

        {/* ------------------------------------------------------ paso 1 */}
        {step === 0 && (
          <>
            <div className="field">
              <label className="field-label" htmlFor="sala">
                Sala de extracción
                <span aria-hidden="true" style={{ color: 'var(--danger-fg)' }}>
                  *
                </span>
              </label>
              <select
                id="sala"
                value={establishmentId}
                onChange={(event) => {
                  setEstablishmentId(event.target.value);
                  setSelected([]);
                  setStepError(null);
                }}
              >
                <option value="">Elegí una sala</option>
                {salas.map((sala) => (
                  <option key={sala.id} value={sala.id}>
                    {sala.name}
                  </option>
                ))}
              </select>
            </div>

            {available.loading && <SkeletonList rows={3} />}

            {establishmentId && !available.loading && options.length === 0 && (
              <Notice tone="info" title="No hay nada para procesar en esta sala">
                Una extracción consume movimientos que ya fueron recibidos. Registrá primero la
                recepción de un traslado.
              </Notice>
            )}

            {/*
              Antes esto era una tabla con casillas de 13 px adentro de un modal.
              Como opciones grandes, cada movimiento es un objetivo comodo y se
              ve de un vistazo que se esta eligiendo.
            */}
            {options.length > 0 && (
              <ChoiceGroup
                label="Movimientos recibidos a procesar"
                multiple
                value={selected}
                onChange={toggle}
                options={options.map((movement) => ({
                  value: movement.id,
                  title: `${movement.code} · ${formatQuantity(movement.quantity, movement.unit)}`,
                  description: MATERIAL_TYPES.label(movement.materialType),
                }))}
              />
            )}

            {chosen.length > 0 && (
              <Notice tone="success" title={`${chosen.length} seleccionado(s)`}>
                Van a procesarse {formatQuantity(totalInput, unit)}.
              </Notice>
            )}

            {stepError && <FormError title={stepError} />}

            <WizardActions
              onBack={onClose}
              onNext={next}
              nextLabel="Continuar"
              disabled={options.length === 0}
            />
          </>
        )}

        {/* ------------------------------------------------------ paso 2 */}
        {step === 1 && (
          <>
            <SummaryList
              rows={[
                {
                  key: 'Sala',
                  value: salas.find((sala) => sala.id === establishmentId)?.name ?? '—',
                },
                { key: 'Movimientos', value: chosen.map((item) => item.code).join(', ') },
                { key: 'Entra', value: formatQuantity(totalInput, unit) },
              ]}
            />

            <div style={{ marginTop: 'var(--sp-5)' }}>
              <Fields
                fields={processFields}
                values={values}
                errors={errors}
                onChange={set}
                onBlur={blur}
              />

              <Field
                spec={{
                  name: 'outputQuantity',
                  label: 'Miel obtenida',
                  type: 'number',
                  step: '0.001',
                  min: '0',
                  inputMode: 'decimal',
                  hint: `No puede superar lo que entró (${formatQuantity(totalInput, unit)}).`,
                  help: 'yield',
                }}
                value={outputQuantity}
                error={outputError ?? undefined}
                onChange={(value) => {
                  setOutputQuantity(value);
                  if (outputError) checkOutput(value);
                }}
                onBlur={() => checkOutput(outputQuantity)}
              />

              {outputQuantity && !outputError && totalInput > 0 && (
                <Notice tone="info" title="Rendimiento">
                  {((Number(outputQuantity) / totalInput) * 100).toFixed(1)} % de lo que entró.
                </Notice>
              )}
            </div>

            <WizardActions
              onBack={() => setStep(0)}
              nextLabel="Registrar extracción"
              submit
              busy={busy}
              busyLabel="Registrando…"
            />
          </>
        )}
      </form>
    </Sheet>
  );
};
