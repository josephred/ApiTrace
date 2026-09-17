import { useState, type FormEvent } from 'react';
import { apiSend } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { useDebounced } from '../lib/useDebounced';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { PERSON_TYPES } from '../lib/vocabulary';
import { Icon } from '../components/Icon';
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatusPill,
  Sheet,
  useWriteFeedback,
} from '../components/ui';
import { DataList, type Column } from '../components/DataList';
import { ResourceNotices } from '../components/ResourceNotices';
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
import type { Paginated, Producer } from '../lib/types';

/* Lo mínimo para dar de alta; el resto vive en un bloque plegado. */
const REQUIRED_FIELDS: FieldSpec[] = [
  { name: 'businessName', label: 'Nombre o razón social', required: true, full: true, autoComplete: 'organization' },
  {
    name: 'personType',
    label: 'Tipo de persona',
    type: 'select',
    required: true,
    defaultValue: 'FISICA',
    options: PERSON_TYPES.options,
  },
  {
    name: 'taxId',
    label: 'CUIT',
    placeholder: '20-12345678-9',
    inputMode: 'numeric',
    hint: 'Identificador fiscal. No es la clave interna del sistema.',
  },
];

const OPTIONAL_FIELDS: FieldSpec[] = [
  { name: 'province', label: 'Provincia' },
  { name: 'locality', label: 'Localidad' },
  { name: 'email', label: 'Correo', type: 'email', inputMode: 'email', autoComplete: 'email' },
  { name: 'phone', label: 'Teléfono', type: 'tel', inputMode: 'tel', autoComplete: 'tel' },
];

const PRODUCER_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

const RENAPA_FIELDS: FieldSpec[] = [
  { name: 'number', label: 'Número de RENAPA', required: true, full: true, help: 'renapa' },
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
  { name: 'issuedAt', label: 'Fecha de alta', type: 'date' },
];

/* =========================================================================
   Listado
   ========================================================================= */

export const ProducersPage = () => {
  const { user, canWrite } = useAuth();
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [creating, setCreating] = useState(false);
  const [renapaFor, setRenapaFor] = useState<Producer | null>(null);

  const query = useDebounced(search);
  const list = useResource<Paginated<Producer>>(
    `/producers?pageSize=${pageSize}${query ? `&q=${encodeURIComponent(query)}` : ''}`,
  );

  const isProducerRole = user?.role === 'PRODUCTOR';
  const items = list.data?.data ?? [];
  const canCreate =
    canWrite && (user?.role === 'ADMIN' || (isProducerRole && list.data && items.length === 0));

  const columns: Column<Producer>[] = [
    {
      key: 'name',
      header: 'Nombre',
      role: 'title',
      cell: (item) => <strong>{item.businessName}</strong>,
    },
    {
      key: 'status',
      header: 'Estado',
      role: 'status',
      cell: (item) => <StatusPill status={item.status} />,
    },
    { key: 'type', header: 'Tipo', cell: (item) => PERSON_TYPES.label(item.personType) },
    {
      key: 'taxId',
      header: 'CUIT',
      cell: (item) => <span className="mono">{item.taxId ?? '—'}</span>,
    },
    {
      key: 'place',
      header: 'Ubicación',
      cell: (item) => [item.locality, item.province].filter(Boolean).join(', ') || '—',
    },
  ];

  return (
    <div className="stack">
      <PageHeader
        title={isProducerRole ? 'Mis datos de productor' : 'Productores'}
        help="producers"
        actions={
          canCreate && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              {isProducerRole ? 'Registrar mis datos' : 'Nuevo productor'}
            </Button>
          )
        }
      />

      <ResourceNotices resource={list} />

      {!isProducerRole && (
        <div className="filters">
          <div className="search-wrap">
            <Icon name="search" size={17} />
            <input
              type="search"
              placeholder="Buscar por nombre o CUIT"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar productores"
            />
          </div>
        </div>
      )}

      <Card flush>
        <DataList
          items={items}
          columns={columns}
          rowKey={(item) => item.id}
          loading={list.loading}
          total={list.data?.meta.total}
          onLoadMore={() => setPageSize((size) => size + 25)}
          loadingMore={list.loading}
          rowActions={
            canWrite
              ? (item) => (
                  <Button size="sm" onClick={() => setRenapaFor(item)}>
                    Asociar RENAPA
                  </Button>
                )
              : undefined
          }
          empty={
            query ? (
              <EmptyState
                icon="search"
                title="Sin resultados"
                description={`No encontramos productores que coincidan con «${query}».`}
                action={
                  <Button onClick={() => setSearch('')} icon="close">
                    Limpiar busqueda
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon="producers"
                title="Todavía no hay productores"
                description="Registrar al productor es el primer paso de la cadena: es quien responde por la actividad."
                action={
                  canCreate && (
                    <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                      Registrar productor
                    </Button>
                  )
                }
              />
            )
          }
        />
      </Card>

      {creating && (
        <CreateProducerSheet
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            list.reload();
          }}
        />
      )}

      {renapaFor && (
        <RenapaSheet
          producer={renapaFor}
          onClose={() => setRenapaFor(null)}
          onDone={() => {
            setRenapaFor(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   Alta de productor
   ========================================================================= */

const CreateProducerSheet = ({ onClose, onDone }: { onClose: () => void; onDone: () => void }) => {
  const { values, set, blur, errors, setErrors, validateAll } = useForm(PRODUCER_FIELDS);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const feedback = useWriteFeedback();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateAll()) return;

    setBusy(true);
    setFailure(null);
    try {
      const result = await apiSend<Producer>('POST', '/producers', buildBody(values, PRODUCER_FIELDS), {
        label: `Productor ${values.businessName}`,
        entity: '/producers',
      });
      if (result.queued) feedback.queued('El productor');
      else feedback.saved('Productor registrado', result.data.businessName);
      onDone();
    } catch (cause) {
      // Los errores por campo van al campo; solo lo que no se puede ubicar
      // queda como aviso general arriba del formulario.
      const perField = fieldErrors(cause, PRODUCER_FIELDS.map((field) => field.name));
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
    <Sheet title="Nuevo productor" subtitle="Los campos con * son obligatorios." onClose={onClose}>
      <Form
        onSubmit={submit}
        error={failure && <FormError title={failure.title} detail={failure.detail} />}
        submitLabel="Registrar productor"
        busyLabel="Registrando…"
        onCancel={onClose}
        busy={busy}
      >
        <Fields
          fields={REQUIRED_FIELDS}
          values={values}
          errors={errors}
          onChange={set}
          onBlur={blur}
        />
        <Disclosure label="Contacto y ubicación (opcional)">
          {OPTIONAL_FIELDS.map((spec) => (
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
   Asociación de RENAPA
   ========================================================================= */

const RenapaSheet = ({
  producer,
  onClose,
  onDone,
}: {
  producer: Producer;
  onClose: () => void;
  onDone: () => void;
}) => {
  const { values, set, blur, errors, setErrors, validateAll } = useForm(RENAPA_FIELDS);
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
        `/producers/${producer.id}/renapa`,
        buildBody(values, RENAPA_FIELDS),
        { label: `RENAPA ${values.number} de ${producer.businessName}`, entity: '/producers' },
      );
      if (result.queued) feedback.queued('La asociación');
      else
        feedback.saved(
          `RENAPA ${values.number} asociado`,
          'Queda sin verificar hasta que exista la integración con SENASA.',
        );
      onDone();
    } catch (cause) {
      const perField = fieldErrors(cause, RENAPA_FIELDS.map((field) => field.name));
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
    <Sheet title="Asociar RENAPA" subtitle={producer.businessName} onClose={onClose}>
      <Form
        onSubmit={submit}
        error={failure && <FormError title={failure.title} detail={failure.detail} />}
        submitLabel="Asociar RENAPA"
        busyLabel="Asociando…"
        onCancel={onClose}
        busy={busy}
      >
        <Fields fields={RENAPA_FIELDS} values={values} errors={errors} onChange={set} onBlur={blur} />
      </Form>
    </Sheet>
  );
};
