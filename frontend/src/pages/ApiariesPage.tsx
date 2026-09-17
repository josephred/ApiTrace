import { useState, type FormEvent } from 'react';
import { apiSend } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { fieldErrors, toUserMessage } from '../lib/errors';
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  Pill,
  Sheet,
  SkeletonList,
  StatusPill,
  useWriteFeedback,
} from '../components/ui';
import { DataList, type Column } from '../components/DataList';
import { ResourceNotices } from '../components/ResourceNotices';
import {
  Fields,
  Form,
  FormError,
  buildBody,
  useForm,
  type FieldSpec,
} from '../components/Form';
import type { Apiary, Establishment, Hive, Paginated } from '../lib/types';

export const ApiariesPage = () => {
  const { canWrite } = useAuth();
  const [creating, setCreating] = useState(false);
  const [hivesFor, setHivesFor] = useState<Apiary | null>(null);
  const [pageSize, setPageSize] = useState(25);

  const list = useResource<Paginated<Apiary>>(`/apiaries?pageSize=${pageSize}`);
  const establishments = useResource<Paginated<Establishment>>(
    '/establishments?pageSize=100&type=APIARIO_BASE',
  );

  const noBase = establishments.data && establishments.data.data.length === 0;

  const columns: Column<Apiary>[] = [
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
    { key: 'name', header: 'Nombre', cell: (item) => item.name ?? '—' },
    {
      key: 'establishment',
      header: 'Establecimiento',
      cell: (item) => item.establishmentName ?? '—',
    },
    {
      key: 'hives',
      header: 'Colmenas',
      align: 'right',
      cell: (item) => item.hiveCount,
    },
    {
      key: 'coords',
      header: 'Coordenadas',
      role: 'hidden',
      cell: (item) =>
        item.latitude && item.longitude ? (
          <span className="mono small">
            {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
          </span>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div className="stack">
      <PageHeader
        title="Apiarios"
        help="apiaries"
        actions={
          canWrite && (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => setCreating(true)}
              disabled={Boolean(noBase)}
            >
              Nuevo apiario
            </Button>
          )
        }
      />

      <ResourceNotices resource={list} />

      {/*
        El orden importa: un apiario necesita un predio que lo contenga. Antes
        el error aparecia recien al intentar guardar, con el formulario lleno.
      */}
      {noBase && canWrite && (
        <Notice tone="info" title="Primero hace falta un predio apícola">
          Un apiario vive dentro de un establecimiento. Registrá uno de tipo «Predio apícola» y
          después volvé acá.
        </Notice>
      )}

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
              {canWrite && (
                <Button size="sm" onClick={() => setHivesFor(item)}>
                  Colmenas
                </Button>
              )}
              <ButtonLink size="sm" to={`/trace/forward/apiary/${item.id}`} icon="trace">
                Dónde terminó
              </ButtonLink>
            </>
          )}
          empty={
            <EmptyState
              icon="apiaries"
              title="Todavía no hay apiarios"
              description="El apiario es el conjunto de colmenas en un punto concreto. Es lo que permite responder de dónde vino la miel."
              action={
                canWrite &&
                !noBase && (
                  <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                    Registrar apiario
                  </Button>
                )
              }
            />
          }
        />
      </Card>

      {creating && (
        <CreateApiarySheet
          establishments={establishments.data?.data ?? []}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            list.reload();
          }}
        />
      )}

      {hivesFor && (
        <HivesSheet
          apiary={hivesFor}
          onClose={() => {
            setHivesFor(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   Alta de apiario
   ========================================================================= */

const CreateApiarySheet = ({
  establishments,
  onClose,
  onDone,
}: {
  establishments: Establishment[];
  onClose: () => void;
  onDone: () => void;
}) => {
  const fields: FieldSpec[] = [
    {
      name: 'establishmentId',
      label: 'Establecimiento',
      type: 'select',
      required: true,
      full: true,
      defaultValue: establishments.length === 1 ? establishments[0].id : '',
      options: establishments.map((item) => ({ value: item.id, label: item.name })),
    },
    { name: 'code', label: 'Código', required: true, placeholder: 'API-001' },
    { name: 'name', label: 'Nombre', placeholder: 'El Ceibo' },
    { name: 'latitude', label: 'Latitud', type: 'number', step: 'any' },
    { name: 'longitude', label: 'Longitud', type: 'number', step: 'any' },
    { name: 'locality', label: 'Localidad' },
    { name: 'province', label: 'Provincia' },
  ];

  const { values, setValues, set, blur, errors, setErrors, validateAll } = useForm(fields);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const feedback = useWriteFeedback();

  /** Estando parado en el apiario, tomar la posicion del teléfono es lo natural. */
  const useCurrentPosition = () => {
    if (!navigator.geolocation) {
      setLocateError('Este dispositivo no puede darnos la ubicación.');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValues((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocateError('No pudimos obtener la ubicación. Podés cargarla a mano.');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateAll()) return;

    setBusy(true);
    setFailure(null);
    try {
      const result = await apiSend<Apiary>('POST', '/apiaries', buildBody(values, fields), {
        label: `Apiario ${values.code}`,
        entity: '/apiaries',
      });
      if (result.queued) feedback.queued('El apiario');
      else feedback.saved('Apiario registrado', result.data.code);
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
    <Sheet title="Nuevo apiario" subtitle="Los campos con * son obligatorios." onClose={onClose}>
      <Form
        onSubmit={submit}
        error={failure && <FormError title={failure.title} detail={failure.detail} />}
        submitLabel="Registrar apiario"
        busyLabel="Registrando…"
        onCancel={onClose}
        busy={busy}
      >
        <Fields fields={fields} values={values} errors={errors} onChange={set} onBlur={blur} />
        <Button icon="location" onClick={useCurrentPosition} busy={locating} busyLabel="Ubicando…">
          Usar mi ubicación actual
        </Button>
        {locateError && (
          <p className="field-error" style={{ marginTop: 'var(--sp-2)' }}>
            {locateError}
          </p>
        )}
      </Form>
    </Sheet>
  );
};

/* =========================================================================
   Colmenas
   ========================================================================= */

const HivesSheet = ({ apiary, onClose }: { apiary: Apiary; onClose: () => void }) => {
  const hives = useResource<Hive[]>(`/apiaries/${apiary.id}/hives`);
  const [code, setCode] = useState('');
  const [type, setType] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const [queued, setQueued] = useState(0);
  const feedback = useWriteFeedback();

  const addHive = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;

    setBusy(true);
    setFailure(null);
    try {
      const result = await apiSend(
        'POST',
        `/apiaries/${apiary.id}/hives`,
        { code: code.trim(), ...(type.trim() ? { type: type.trim() } : {}) },
        { label: `Colmena ${code} en ${apiary.code}`, entity: '/apiaries' },
      );
      setCode('');
      if (result.queued) setQueued((count) => count + 1);
      else {
        feedback.saved('Colmena agregada', code);
        hives.reload();
      }
    } catch (cause) {
      const message = toUserMessage(cause, 'write');
      setFailure({ title: message.title, detail: message.detail });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Colmenas" subtitle={`Apiario ${apiary.code}`} onClose={onClose}>
      {failure && <FormError title={failure.title} detail={failure.detail} />}
      {queued > 0 && (
        <Notice tone="info" title="Guardadas en el dispositivo">
          {queued === 1
            ? '1 colmena se enviará al recuperar la señal.'
            : `${queued} colmenas se enviarán al recuperar la señal.`}
        </Notice>
      )}

      {/* Alta rapida: cargar colmenas es una tarea repetitiva, el campo vuelve a
          quedar vacío y con el foco para encadenar varias seguidas. */}
      <form onSubmit={addHive} style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="hive-code">
              Código
              <span aria-hidden="true" style={{ color: 'var(--danger-fg)' }}>
                *
              </span>
            </label>
            <input
              id="hive-code"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="COL-0001"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="hive-type">
              Tipo
              <span className="field-optional">opcional</span>
            </label>
            <input
              id="hive-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              placeholder="Langstroth"
              autoComplete="off"
            />
          </div>
        </div>
        <Button
          type="submit"
          variant="primary"
          icon="plus"
          block
          busy={busy}
          busyLabel="Agregando…"
          disabled={!code.trim()}
        >
          Agregar colmena
        </Button>
      </form>

      {hives.loading && <SkeletonList rows={3} />}

      {hives.data && hives.data.length > 0 ? (
        <>
          <div className="form-section-title">
            {hives.data.length === 1 ? '1 colmena registrada' : `${hives.data.length} colmenas registradas`}
          </div>
          <div className="dl-cards" style={{ display: 'block' }}>
            {hives.data.map((hive) => (
              <div className="dl-card" key={hive.id}>
                <div className="dl-card-top">
                  <span className="dl-card-title mono">{hive.code}</span>
                  <Pill tone={hive.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {hive.status === 'ACTIVE' ? 'Activa' : hive.status}
                  </Pill>
                </div>
                <div className="small muted">{hive.type ?? 'Sin tipo'}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        !hives.loading && (
          <p className="muted small">Todavía no hay colmenas cargadas en este apiario.</p>
        )
      )}
    </Sheet>
  );
};
