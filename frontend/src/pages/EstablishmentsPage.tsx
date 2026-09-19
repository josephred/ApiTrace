import { useState, type FormEvent } from 'react';
import { apiSend } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { ESTABLISHMENT_TYPES } from '../lib/vocabulary';
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
import { OfficialRegistrySheet } from '../components/OfficialRegistrySheet';
import {
  Disclosure,
  Field,
  Fields,
  Form,
  FormError,
  buildBody,
  useForm,
  type FieldSpec,
} from '../components/Form';
import type { Establishment, Paginated, Producer } from '../lib/types';

export const EstablishmentsPage = () => {
  const { canWrite } = useAuth();
  const [typeFilter, setTypeFilter] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [creating, setCreating] = useState(false);
  const [renspaFor, setRenspaFor] = useState<Establishment | null>(null);
  const [senasaFor, setSenasaFor] = useState<Establishment | null>(null);

  const list = useResource<Paginated<Establishment>>(
    `/establishments?pageSize=${pageSize}${typeFilter ? `&type=${typeFilter}` : ''}`,
  );
  const producers = useResource<Paginated<Producer>>('/producers?pageSize=100');

  const columns: Column<Establishment>[] = [
    {
      key: 'name',
      header: 'Nombre',
      role: 'title',
      cell: (item) => <strong>{item.name}</strong>,
    },
    {
      key: 'status',
      header: 'Estado',
      role: 'status',
      cell: (item) => <StatusPill status={item.status} />,
    },
    { key: 'type', header: 'Tipo', cell: (item) => ESTABLISHMENT_TYPES.label(item.type) },
    {
      key: 'place',
      header: 'Ubicación',
      cell: (item) => [item.locality, item.province].filter(Boolean).join(', ') || '—',
    },
    {
      key: 'rne',
      header: 'RNE',
      cell: (item) => <span className="mono">{item.rne ?? '—'}</span>,
    },
    {
      key: 'senasa',
      header: 'SENASA',
      cell: (item) =>
        item.senasaCode ? (
          <span className="mono font-medium">{item.senasaCode}</span>
        ) : (
          <span className="faint small">Sin registrar</span>
        ),
    },
  ];

  return (
    <div className="stack">
      <PageHeader
        title="Establecimientos"
        help="establishments"
        actions={
          canWrite && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Nuevo establecimiento
            </Button>
          )
        }
      />

      <ResourceNotices resource={list} />

      <div className="filters">
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos los tipos</option>
          {ESTABLISHMENT_TYPES.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
            <div className="row row-tight">
              <ButtonLink size="sm" to={`/trace/forward/establishment/${item.id}`} icon="trace">
                Trazar
              </ButtonLink>
              {canWrite && (
                <>
                  <Button size="sm" onClick={() => setRenspaFor(item)}>
                    RENSPA
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setSenasaFor(item)}>
                    Habilitación SENASA
                  </Button>
                </>
              )}
            </div>
          )}
          empty={
            <EmptyState
              icon="establishments"
              title={typeFilter ? 'Sin establecimientos de ese tipo' : 'Todavía no hay establecimientos'}
              description={
                typeFilter
                  ? 'Probá con otro tipo o quita el filtro.'
                  : 'Los movimientos conectan un establecimiento de origen con uno de destino: sin ellos no hay cadena.'
              }
              action={
                typeFilter ? (
                  <Button onClick={() => setTypeFilter('')} icon="close">
                    Quitar filtro
                  </Button>
                ) : (
                  canWrite && (
                    <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                      Registrar establecimiento
                    </Button>
                  )
                )
              }
            />
          }
        />
      </Card>

      {creating && (
        <CreateEstablishmentSheet
          producers={producers.data?.data ?? []}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            list.reload();
          }}
        />
      )}

      {renspaFor && (
        <RenspaSheet
          establishment={renspaFor}
          producers={producers.data?.data ?? []}
          onClose={() => setRenspaFor(null)}
          onDone={() => {
            setRenspaFor(null);
            list.reload();
          }}
        />
      )}

      {senasaFor && (
        <OfficialRegistrySheet
          target={{ type: 'establishment', data: senasaFor }}
          onClose={() => setSenasaFor(null)}
          onDone={() => {
            setSenasaFor(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   Alta
   ========================================================================= */

const CreateEstablishmentSheet = ({
  producers,
  onClose,
  onDone,
}: {
  producers: Producer[];
  onClose: () => void;
  onDone: () => void;
}) => {
  const core: FieldSpec[] = [
    { name: 'name', label: 'Nombre', required: true, full: true },
    {
      name: 'type',
      label: 'Tipo',
      type: 'select',
      required: true,
      options: ESTABLISHMENT_TYPES.options,
    },
    {
      name: 'producerId',
      label: 'Productor responsable',
      type: 'select',
      options: producers.map((producer) => ({ value: producer.id, label: producer.businessName })),
      hint: 'Una sala o un acopio puede no tener productor asociado.',
    },
  ];

  const extra: FieldSpec[] = [
    { name: 'locality', label: 'Localidad' },
    { name: 'province', label: 'Provincia' },
    { name: 'address', label: 'Domicilio', full: true },
    { name: 'rne', label: 'RNE', help: 'rne' },
    { name: 'latitude', label: 'Latitud', type: 'number', step: 'any', placeholder: '-34.570300' },
    { name: 'longitude', label: 'Longitud', type: 'number', step: 'any', placeholder: '-59.105300' },
  ];

  const all = [...core, ...extra];
  const { values, set, blur, errors, setErrors, validateAll } = useForm(all);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const feedback = useWriteFeedback();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateAll()) return;

    setBusy(true);
    setFailure(null);
    try {
      const result = await apiSend<Establishment>(
        'POST',
        '/establishments',
        buildBody(values, all),
        { label: `Establecimiento ${values.name}`, entity: '/establishments' },
      );
      if (result.queued) feedback.queued('El establecimiento');
      else feedback.saved('Establecimiento registrado', result.data.name);
      onDone();
    } catch (cause) {
      const perField = fieldErrors(cause, all.map((field) => field.name));
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
      title="Nuevo establecimiento"
      subtitle="Los campos con * son obligatorios."
      onClose={onClose}
    >
      <Form
        onSubmit={submit}
        error={failure && <FormError title={failure.title} detail={failure.detail} />}
        submitLabel="Registrar establecimiento"
        busyLabel="Registrando…"
        onCancel={onClose}
        busy={busy}
      >
        <Fields fields={core} values={values} errors={errors} onChange={set} onBlur={blur} />
        <Disclosure label="Ubicación y registro (opcional)">
          {extra.map((spec) => (
            <Field
              key={spec.name}
              spec={spec}
              value={values[spec.name] ?? ''}
              error={errors[spec.name]}
              onChange={(value) => set(spec.name, value)}
              onBlur={() => blur(spec.name)}
            />
          ))}
        </Disclosure>
      </Form>
    </Sheet>
  );
};

/* =========================================================================
   RENSPA
   ========================================================================= */

const RenspaSheet = ({
  establishment,
  producers,
  onClose,
  onDone,
}: {
  establishment: Establishment;
  producers: Producer[];
  onClose: () => void;
  onDone: () => void;
}) => {
  const fields: FieldSpec[] = [
    {
      name: 'number',
      label: 'Número de RENSPA',
      required: true,
      placeholder: '01.006.0.00123/45',
      help: 'renspa',
      full: true,
    },
    {
      name: 'producerId',
      label: 'Titular del predio',
      type: 'select',
      required: true,
      options: producers.map((producer) => ({ value: producer.id, label: producer.businessName })),
      hint: 'Puede no ser quien trabaja las colmenas.',
    },
    { name: 'activity', label: 'Actividad', defaultValue: 'Apícola' },
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      required: true,
      defaultValue: 'PENDING_VERIFICATION',
      options: [
        { value: 'PENDING_VERIFICATION', label: 'Sin verificar' },
        { value: 'ACTIVE', label: 'Activo' },
        { value: 'SUSPENDED', label: 'Suspendido' },
      ],
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
      const result = await apiSend(
        'POST',
        `/establishments/${establishment.id}/renspa`,
        buildBody(values, fields),
        { label: `RENSPA ${values.number} de ${establishment.name}`, entity: '/establishments' },
      );
      if (result.queued) feedback.queued('La asociación');
      else feedback.saved(`RENSPA ${values.number} asociado`, establishment.name);
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
    <Sheet title="Asociar RENSPA" subtitle={establishment.name} help="renspa" onClose={onClose}>
      <Form
        onSubmit={submit}
        error={failure && <FormError title={failure.title} detail={failure.detail} />}
        submitLabel="Asociar RENSPA"
        busyLabel="Asociando…"
        onCancel={onClose}
        busy={busy}
      >
        <Fields fields={fields} values={values} errors={errors} onChange={set} onBlur={blur} />
      </Form>
    </Sheet>
  );
};
