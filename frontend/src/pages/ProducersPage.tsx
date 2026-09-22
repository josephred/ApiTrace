import { useState, type FormEvent } from 'react';
import { apiSend } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { useDebounced } from '../lib/useDebounced';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { DELEGATION_STATUSES, PERSON_TYPES, SENASA_SERVICES } from '../lib/vocabulary';
import { formatDateTime } from '../lib/format';
import { Icon } from '../components/Icon';
import {
  Button,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  SkeletonList,
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
import type { Paginated, Producer, SenasaDelegation } from '../lib/types';

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
  const [delegationFor, setDelegationFor] = useState<Producer | null>(null);

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
          rowActions={(item) => (
            <>
              {canWrite && (
                <Button size="sm" onClick={() => setRenapaFor(item)}>
                  Asociar RENAPA
                </Button>
              )}
              <Button size="sm" onClick={() => setDelegationFor(item)}>
                Delegación SENASA
              </Button>
            </>
          )}
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

      {delegationFor && (
        <DelegationSheet
          producer={delegationFor}
          canWrite={canWrite}
          onClose={() => setDelegationFor(null)}
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
    <Sheet title="Asociar RENAPA" subtitle={producer.businessName} help="renapa" onClose={onClose}>
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

/* =========================================================================
   Delegacion de servicios SENASA en ApiTrace
   ========================================================================= */

/**
 * Para que ApiTrace emita (SIGSA) o cierre (SITA) DT-e en nombre del titular,
 * el titular delega el servicio en ARCA. ApiTrace no puede verificarlo por su
 * cuenta: aca se registra el estado para saber a quien se le puede emitir.
 */
const DelegationSheet = ({
  producer,
  canWrite,
  onClose,
}: {
  producer: Producer;
  canWrite: boolean;
  onClose: () => void;
}) => {
  const delegations = useResource<SenasaDelegation[]>(
    `/producers/${producer.id}/senasa-delegations`,
  );
  const [editing, setEditing] = useState<SenasaDelegation['service'] | null>(null);

  return (
    <Sheet
      title="Delegación en ApiTrace"
      subtitle={producer.businessName}
      help="delegation"
      onClose={onClose}
    >
      <Notice tone="info" title="Se delega en ARCA">
        Desde ARCA, en el Administrador de Relaciones de Clave Fiscal (formulario F3283/E), el
        titular delega el servicio de SENASA en la CUIT de ApiTrace. Acá se registra el estado para
        saber si ApiTrace puede operar en su nombre.
      </Notice>

      {delegations.loading && <SkeletonList rows={2} />}
      <ResourceNotices resource={delegations} />

      {(delegations.data ?? []).map((item) =>
        editing === item.service ? (
          <DelegationForm
            key={item.service}
            producer={producer}
            delegation={item}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              delegations.reload();
            }}
          />
        ) : (
          <div className="dl-card" key={item.service} style={{ marginTop: 'var(--sp-3)' }}>
            <div className="dl-card-top">
              <span className="dl-card-title">{SENASA_SERVICES.label(item.service)}</span>
              <StatusPill status={item.status} />
            </div>
            <div className="small muted">
              {item.formNumber ? `Constancia ${item.formNumber}` : 'Sin constancia registrada'}
              {item.updatedAt ? ` · actualizado ${formatDateTime(item.updatedAt)}` : ''}
            </div>
            {item.notes && <div className="small">{item.notes}</div>}
            {canWrite && (
              <div style={{ marginTop: 'var(--sp-2)' }}>
                <Button size="sm" onClick={() => setEditing(item.service)}>
                  Actualizar estado
                </Button>
              </div>
            )}
          </div>
        ),
      )}
    </Sheet>
  );
};

const DelegationForm = ({
  producer,
  delegation,
  onCancel,
  onDone,
}: {
  producer: Producer;
  delegation: SenasaDelegation;
  onCancel: () => void;
  onDone: () => void;
}) => {
  const fields: FieldSpec[] = [
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      required: true,
      defaultValue: delegation.status,
      options: DELEGATION_STATUSES.options,
    },
    {
      name: 'formNumber',
      label: 'N° de constancia (F3283/E)',
      defaultValue: delegation.formNumber ?? '',
    },
    {
      name: 'delegatedToTaxId',
      label: 'CUIT del representante',
      placeholder: '30-71234567-9',
      inputMode: 'numeric',
      defaultValue: delegation.delegatedToTaxId ?? '',
    },
    {
      name: 'notes',
      label: 'Notas',
      type: 'textarea',
      full: true,
      defaultValue: delegation.notes ?? '',
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
        'PUT',
        `/producers/${producer.id}/senasa-delegations/${delegation.service}`,
        buildBody(values, fields),
        {
          label: `Delegación ${SENASA_SERVICES.label(delegation.service)} de ${producer.businessName}`,
          entity: '/producers',
        },
      );
      if (result.queued) feedback.queued('El cambio');
      else feedback.saved('Delegación actualizada', SENASA_SERVICES.label(delegation.service));
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
    <div className="card" style={{ marginTop: 'var(--sp-3)', padding: 'var(--sp-4)' }}>
      <div className="form-section-title">{SENASA_SERVICES.label(delegation.service)}</div>
      <Form
        onSubmit={submit}
        error={failure && <FormError title={failure.title} detail={failure.detail} />}
        submitLabel="Guardar"
        busyLabel="Guardando…"
        onCancel={onCancel}
        busy={busy}
      >
        <Fields fields={fields} values={values} errors={errors} onChange={set} onBlur={blur} />
      </Form>
    </div>
  );
};
