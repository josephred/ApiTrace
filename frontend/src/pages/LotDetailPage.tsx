import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiSend } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { formatDate, formatDateTime, formatQuantity, toLocalInput } from '../lib/format';
import { LOT_TYPES, SOURCE_TYPES, eventLabel } from '../lib/vocabulary';
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorNotice,
  Notice,
  PageHeader,
  Pill,
  Sheet,
  SkeletonList,
  Stat,
  StatusPill,
  useWriteFeedback,
} from '../components/ui';
import { DataList, type Column } from '../components/DataList';
import { ResourceNotices } from '../components/ResourceNotices';
import { Fields, Form, FormError, buildBody, useForm, type FieldSpec } from '../components/Form';
import type { Drum, Lot, LotInput, TimelineEvent } from '../lib/types';

export const LotDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { canWrite } = useAuth();
  const [addingDrum, setAddingDrum] = useState(false);
  const [addingSample, setAddingSample] = useState(false);

  const lot = useResource<Lot>(id ? `/lots/${id}` : null);
  const timeline = useResource<{ events: TimelineEvent[] }>(
    id ? `/traceability/timeline/lot/${id}` : null,
  );

  if (lot.loading) {
    return (
      <div className="stack">
        <PageHeader title="Lote" back={{ to: '/lots', label: 'Lotes' }} />
        <Card flush>
          <SkeletonList rows={4} />
        </Card>
      </div>
    );
  }

  if (lot.error) {
    return (
      <div className="stack">
        <PageHeader title="Lote" back={{ to: '/lots', label: 'Lotes' }} />
        <ErrorNotice message={lot.error} onRetry={lot.reload} />
      </div>
    );
  }

  if (!lot.data) return null;

  const data = lot.data;
  const summary = data.summary;
  const packed =
    summary && summary.quantity > 0
      ? Math.round((summary.netWeightInDrums / summary.quantity) * 100)
      : 0;
  const withoutOrigin = data.inputs && data.inputs.length === 0;

  const inputColumns: Column<LotInput>[] = [
    {
      key: 'source',
      header: 'Origen',
      role: 'title',
      cell: (item) => (
        <span className="row row-tight">
          <Pill tone="info">{SOURCE_TYPES[item.sourceType] ?? item.sourceType}</Pill>
          {item.sourceLotId && <Link to={`/lots/${item.sourceLotId}`}>ver lote</Link>}
          {item.sourceMovementId && (
            <Link to={`/movements/${item.sourceMovementId}`}>ver movimiento</Link>
          )}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      align: 'right',
      cell: (item) => formatQuantity(item.quantity, item.unit),
    },
  ];

  const drumColumns: Column<Drum>[] = [
    {
      key: 'code',
      header: 'Código',
      role: 'title',
      cell: (item) => <span className="mono">{item.code}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      role: 'status',
      cell: (item) => <StatusPill status={item.status} />,
    },
    {
      key: 'net',
      header: 'Neto',
      align: 'right',
      cell: (item) => formatQuantity(item.netWeight, item.unit),
    },
    {
      key: 'seal',
      header: 'Precinto',
      cell: (item) => <span className="mono">{item.sealNumber ?? '—'}</span>,
    },
  ];

  return (
    <div className="stack">
      <PageHeader
        title={data.honeyType ?? 'Lote sin clasificar'}
        code={data.code}
        status={<StatusPill status={data.status} />}
        sub={`${LOT_TYPES.label(data.lotType)} · producido el ${formatDate(data.productionDate)}`}
        back={{ to: '/lots', label: 'Lotes' }}
        actions={
          <>
            <ButtonLink to={`/trace/backward/lot/${data.id}`} icon="trace">
              De dónde vino
            </ButtonLink>
            <ButtonLink to={`/trace/forward/lot/${data.id}`} icon="forward">
              Dónde terminó
            </ButtonLink>
          </>
        }
      />

      <ResourceNotices resource={lot} />

      {withoutOrigin && (
        <Notice tone="warning" title="Este lote no declara de qué se compone">
          Su origen no puede reconstruirse: la consulta de trazabilidad lo va a reportar como hueco.
        </Notice>
      )}

      <div className="grid c4">
        <Stat label="Cantidad" value={formatQuantity(data.quantity, data.unit)} />
        <Stat
          label="Disponible"
          value={formatQuantity(data.availableQuantity, data.unit)}
          hint="sin consumir por otros lotes"
          help="availableQuantity"
        />
        <Stat
          label="Tambores"
          value={summary?.drumCount ?? 0}
          hint={`${formatQuantity(summary?.netWeightInDrums, data.unit)} · ${packed} % envasado`}
          help="drums"
        />
        <Stat
          label="Humedad"
          value={data.moisturePercent ? `${data.moisturePercent} %` : '—'}
        />
      </div>

      <div className="grid c2">
        <Card title="De qué se compone" help="lotOrigin" flush>
          <DataList
            items={data.inputs ?? []}
            columns={inputColumns}
            rowKey={(item) => item.id}
            empty={
              <EmptyState
                icon="warning"
                title="Sin origen declarado"
                description="No se registró de donde viene la miel de este lote."
              />
            }
          />
        </Card>

        <Card
          title="Tambores"
          help="drums"
          actions={
            canWrite && (
              <Button size="sm" variant="primary" icon="plus" onClick={() => setAddingDrum(true)}>
                Registrar tambor
              </Button>
            )
          }
          flush
        >
          <DataList
            items={data.drums ?? []}
            columns={drumColumns}
            rowKey={(item) => item.id}
            empty={
              <EmptyState
                icon="drums"
                title="Todavía no hay tambores"
                description="El tambor es la unidad física. La suma de los pesos netos no puede superar la cantidad del lote."
                action={
                  canWrite && (
                    <Button variant="primary" icon="plus" onClick={() => setAddingDrum(true)}>
                      Registrar el primero
                    </Button>
                  )
                }
              />
            }
          />
        </Card>
      </div>

      <Card
        title="Historial"
        actions={
          canWrite && (
            <Button size="sm" icon="document" onClick={() => setAddingSample(true)}>
              Registrar muestra
            </Button>
          )
        }
      >
        {timeline.data && timeline.data.events.length > 0 ? (
          <ul className="timeline">
            {timeline.data.events.map((event) => (
              <li key={event.id}>
                <div className="timeline-what">{eventLabel(event.eventType)}</div>
                <div className="timeline-when">{formatDateTime(event.recordedAt)}</div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="audit"
            title="Sin eventos"
            description="Cada acción sobre este lote va a quedar registrada acá."
          />
        )}
      </Card>

      {addingDrum && (
        <DrumSheet
          lot={data}
          onClose={() => setAddingDrum(false)}
          onDone={() => {
            setAddingDrum(false);
            lot.reload();
            timeline.reload();
          }}
        />
      )}

      {addingSample && (
        <SampleSheet
          lot={data}
          onClose={() => setAddingSample(false)}
          onDone={() => {
            setAddingSample(false);
            timeline.reload();
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   Tambor
   ========================================================================= */

const DrumSheet = ({
  lot,
  onClose,
  onDone,
}: {
  lot: Lot;
  onClose: () => void;
  onDone: () => void;
}) => {
  const remaining = Number(lot.quantity) - (lot.summary?.netWeightInDrums ?? 0);

  const fields: FieldSpec[] = [
    {
      name: 'netWeight',
      label: 'Peso neto (kg)',
      type: 'number',
      step: '0.001',
      min: '0',
      required: true,
      inputMode: 'decimal',
      validate: (value) =>
        Number(value) > remaining
          ? `Quedan ${formatQuantity(remaining, lot.unit)} sin envasar en este lote.`
          : null,
    },
    {
      name: 'filledAt',
      label: 'Fecha de llenado',
      type: 'datetime-local',
      required: true,
      defaultValue: toLocalInput(),
    },
    {
      name: 'code',
      label: 'Código',
      hint: 'Si lo dejas vacío, se genera solo.',
    },
    { name: 'sealNumber', label: 'Precinto' },
    { name: 'tareWeight', label: 'Tara (kg)', type: 'number', step: '0.001', inputMode: 'decimal' },
    { name: 'grossWeight', label: 'Bruto (kg)', type: 'number', step: '0.001', inputMode: 'decimal' },
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
      const result = await apiSend('POST', `/lots/${lot.id}/drums`, buildBody(values, fields), {
        label: `Tambor de ${values.netWeight} kg en ${lot.code}`,
        entity: '/lots',
      });
      if (result.queued) feedback.queued('El tambor');
      else feedback.saved('Tambor registrado', `${values.netWeight} kg en ${lot.code}`);
      onDone();
    } catch (cause) {
      const perField = fieldErrors(cause, fields.map((field) => field.name));
      if (Object.keys(perField).length > 0) setErrors((current) => ({ ...current, ...perField }));
      else {
        const message = toUserMessage(cause, 'write');
        setFailure({ title: message.title, detail: message.detail });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Registrar tambor" subtitle={`Lote ${lot.code}`} onClose={onClose}>
      <Notice tone="info" title={`Quedan ${formatQuantity(remaining, lot.unit)} sin envasar`}>
        Si cargás bruto y tara, el neto tiene que coincidir con la diferencia.
      </Notice>
      <Form
        onSubmit={submit}
        error={failure && <FormError title={failure.title} detail={failure.detail} />}
        submitLabel="Registrar tambor"
        busyLabel="Registrando…"
        onCancel={onClose}
        busy={busy}
      >
        <Fields fields={fields} values={values} errors={errors} onChange={set} onBlur={blur} />
      </Form>
    </Sheet>
  );
};

/* =========================================================================
   Muestra
   ========================================================================= */

const SampleSheet = ({
  lot,
  onClose,
  onDone,
}: {
  lot: Lot;
  onClose: () => void;
  onDone: () => void;
}) => {
  const fields: FieldSpec[] = [
    {
      name: 'takenAt',
      label: 'Fecha de toma',
      type: 'datetime-local',
      required: true,
      defaultValue: toLocalInput(),
    },
    { name: 'takenBy', label: 'Tomada por' },
    {
      name: 'analysisType',
      label: 'Análisis solicitado',
      full: true,
      placeholder: 'HMF, humedad y conductividad',
    },
    { name: 'notes', label: 'Observaciones', type: 'textarea', full: true },
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
      const result = await apiSend(
        'POST',
        '/samples',
        { lotId: lot.id, ...buildBody(values, fields) },
        { label: `Muestra del lote ${lot.code}`, entity: '/lots' },
      );
      if (result.queued) feedback.queued('La muestra');
      else feedback.saved('Muestra registrada', lot.code);
      onDone();
    } catch (cause) {
      const perField = fieldErrors(cause, fields.map((field) => field.name));
      if (Object.keys(perField).length > 0) setErrors((current) => ({ ...current, ...perField }));
      else {
        const message = toUserMessage(cause, 'write');
        setFailure({ title: message.title, detail: message.detail });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Registrar muestra" subtitle={`Lote ${lot.code}`} onClose={onClose}>
      <Form
        onSubmit={submit}
        error={failure && <FormError title={failure.title} detail={failure.detail} />}
        submitLabel="Registrar muestra"
        busyLabel="Registrando…"
        onCancel={onClose}
        busy={busy}
      >
        <Fields fields={fields} values={values} errors={errors} onChange={set} onBlur={blur} />
      </Form>
    </Sheet>
  );
};
