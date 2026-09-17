import { useState, type FormEvent } from 'react';
import { apiSend } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { formatDate, formatQuantity, toLocalInput } from '../lib/format';
import { ESTABLISHMENT_TYPES, statusInfo } from '../lib/vocabulary';
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  Sheet,
  StatusPill,
  useWriteFeedback,
} from '../components/ui';
import { DataList, type Column } from '../components/DataList';
import { ResourceNotices } from '../components/ResourceNotices';
import { Fields, Form, FormError, buildBody, useForm, type FieldSpec } from '../components/Form';
import type { Drum, Establishment, Paginated } from '../lib/types';

const DRUM_STATUSES = ['FILLED', 'IN_STOCK', 'IN_TRANSIT', 'DISPATCHED', 'CONSUMED', 'EMPTY'];

export const DrumsPage = () => {
  const { canWrite } = useAuth();
  const [status, setStatus] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [transferring, setTransferring] = useState<Drum | null>(null);

  const list = useResource<Paginated<Drum>>(
    `/drums?pageSize=${pageSize}${status ? `&status=${status}` : ''}`,
  );
  const establishments = useResource<Paginated<Establishment>>('/establishments?pageSize=100');
  const nameById = new Map((establishments.data?.data ?? []).map((item) => [item.id, item.name]));

  const columns: Column<Drum>[] = [
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
      key: 'net',
      header: 'Neto',
      align: 'right',
      cell: (item) => formatQuantity(item.netWeight, item.unit),
    },
    {
      key: 'location',
      header: 'Ubicación',
      cell: (item) =>
        item.locationEstablishmentId
          ? (nameById.get(item.locationEstablishmentId) ?? 'Otro establecimiento')
          : '—',
    },
    {
      key: 'filled',
      header: 'Llenado',
      cell: (item) => <span className="nowrap">{formatDate(item.filledAt)}</span>,
    },
  ];

  return (
    <div className="stack">
      <PageHeader title="Tambores" help="drums" />

      <ResourceNotices resource={list} />

      <div className="filters">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {DRUM_STATUSES.map((option) => (
            <option key={option} value={option}>
              {statusInfo(option).label}
            </option>
          ))}
        </select>
        {status && (
          <Button size="sm" icon="close" onClick={() => setStatus('')}>
            Quitar filtro
          </Button>
        )}
      </div>

      <Card flush>
        <DataList
          items={list.data?.data ?? []}
          columns={columns}
          rowKey={(item) => item.id}
          loading={list.loading}
          total={list.data?.meta.total}
          onLoadMore={() => setPageSize((size) => size + 25)}
          loadingMore={list.loading}
          rowActions={(item) => (
            <>
              <ButtonLink size="sm" to={`/trace/backward/drum/${item.id}`} icon="trace">
                De dónde vino
              </ButtonLink>
              {canWrite && item.status !== 'CONSUMED' && (
                <Button size="sm" onClick={() => setTransferring(item)}>
                  Trasladar
                </Button>
              )}
            </>
          )}
          empty={
            <EmptyState
              icon="drums"
              title={status ? 'No hay tambores en ese estado' : 'Todavía no hay tambores'}
              description={
                status
                  ? 'Probá con otro estado o quita el filtro.'
                  : 'Los tambores se registran desde el detalle de un lote, que es de donde sale la miel que envasan.'
              }
              action={
                status ? (
                  <Button onClick={() => setStatus('')} icon="close">
                    Ver todos
                  </Button>
                ) : (
                  <ButtonLink to="/lots" variant="primary" icon="lots">
                    Ir a lotes
                  </ButtonLink>
                )
              }
            />
          }
        />
      </Card>

      {transferring && (
        <TransferSheet
          drum={transferring}
          establishments={establishments.data?.data ?? []}
          onClose={() => setTransferring(null)}
          onDone={() => {
            setTransferring(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   Traslado
   ========================================================================= */

const TransferSheet = ({
  drum,
  establishments,
  onClose,
  onDone,
}: {
  drum: Drum;
  establishments: Establishment[];
  onClose: () => void;
  onDone: () => void;
}) => {
  const fields: FieldSpec[] = [
    {
      name: 'toEstablishmentId',
      label: 'Nuevo establecimiento',
      type: 'select',
      required: true,
      full: true,
      options: establishments
        .filter((item) => item.id !== drum.locationEstablishmentId)
        .map((item) => ({
          value: item.id,
          label: `${item.name} · ${ESTABLISHMENT_TYPES.label(item.type)}`,
        })),
    },
    {
      name: 'occurredAt',
      label: 'Fecha del traslado',
      type: 'datetime-local',
      required: true,
      full: true,
      defaultValue: toLocalInput(),
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
        `/drums/${drum.id}/transfer`,
        buildBody(values, fields),
        { label: `Traslado del tambor ${drum.code}`, entity: '/drums' },
      );
      if (result.queued) feedback.queued('El traslado');
      else feedback.saved('Tambor trasladado', drum.code);
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
    <Sheet
      title="Trasladar tambor"
      subtitle={`${drum.code} · ${formatQuantity(drum.netWeight, drum.unit)}`}
      onClose={onClose}
    >
      <Form
        onSubmit={submit}
        error={failure && <FormError title={failure.title} detail={failure.detail} />}
        submitLabel="Confirmar traslado"
        busyLabel="Trasladando…"
        onCancel={onClose}
        busy={busy}
      >
        <Fields fields={fields} values={values} errors={errors} onChange={set} onBlur={blur} />
      </Form>
    </Sheet>
  );
};
