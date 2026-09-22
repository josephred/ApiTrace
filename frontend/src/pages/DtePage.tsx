import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiSend, NetworkError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePreferences } from '../lib/settingsContext';
import { useResource } from '../lib/useResource';
import { fieldErrors, toUserMessage } from '../lib/errors';
import {
  DEFAULT_VALIDITY_DAYS,
  DTE_STATUS_FILTERS,
  MAX_VALIDITY_DAYS,
  addDaysIso,
  daysBetweenIso,
  formatDay,
  suggestDeclared,
  todayAr,
} from '../lib/dte';
import { INTEGRATION_MODES, TRANSPORT_TYPES, statusInfo } from '../lib/vocabulary';
import {
  Button,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  Pill,
  Sheet,
  Stat,
  StatusPill,
  SummaryList,
  useWriteFeedback,
} from '../components/ui';
import { DataList, type Column } from '../components/DataList';
import { ResourceNotices } from '../components/ResourceNotices';
import {
  Disclosure,
  Field,
  Fields,
  FormError,
  Steps,
  WizardActions,
  useForm,
  type FieldSpec,
} from '../components/Form';
import { DteChecks } from '../components/DteChecks';
import type {
  Apiary,
  Dte,
  DteListItem,
  DtePreflight,
  DteSummary,
  Paginated,
  Receiver,
} from '../lib/types';

type Perspective = 'emitidos' | 'recibidos' | 'todos';

const PERSPECTIVES: { value: Perspective; label: string }[] = [
  { value: 'emitidos', label: 'Los que emito' },
  { value: 'recibidos', label: 'Los que recibo' },
  { value: 'todos', label: 'Todos' },
];

/* =========================================================================
   Listado por usuario
   ========================================================================= */

/**
 * Los DT-e de la persona: los que emite su organizacion y los que llegan a sus
 * salas. El productor ve primero lo que emite; la sala, lo que tiene que cerrar.
 * El estado ya viene calculado con la fecha: un DT-e emitido pasa solo a
 * vigente el dia de la carga, y a vencido si nadie lo cierra.
 */
export const DtePage = () => {
  const { user, canWrite, hasRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const [pageSize, setPageSize] = useState(25);
  const [creating, setCreating] = useState(false);

  const receiverRole = user?.role === 'SALA' || user?.role === 'ACOPIADOR';
  const defaultPerspective: Perspective = receiverRole
    ? 'recibidos'
    : user?.role === 'PRODUCTOR'
      ? 'emitidos'
      : 'todos';
  const perspective = (params.get('perspective') as Perspective | null) ?? defaultPerspective;
  const status = params.get('status') ?? '';
  const mine = params.get('mine') === 'true';

  const query = new URLSearchParams({ pageSize: String(pageSize), perspective });
  if (status) query.set('status', status);
  if (mine) query.set('mine', 'true');

  const list = useResource<Paginated<DteListItem>>(`/dte?${query.toString()}`);
  const summary = useResource<DteSummary>('/dte/summary');
  const canIssue = canWrite && hasRole('PRODUCTOR');

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  };

  const data = summary.data;
  const integration = data?.integration;

  const columns: Column<DteListItem>[] = [
    {
      key: 'number',
      header: 'DT-e',
      role: 'title',
      cell: (item) =>
        item.number ? (
          <strong className="mono">{item.number}</strong>
        ) : (
          <span className="faint">Sin número</span>
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      role: 'status',
      cell: (item) => <StatusPill status={item.status} />,
    },
    {
      key: 'transit',
      header: 'Tránsito',
      cell: (item) =>
        item.aptForTransit ? (
          <Pill tone="success" icon="check">
            Apto
          </Pill>
        ) : item.status === 'EMITIDO' ? (
          <Pill tone="warning">Desde {formatDay(item.loadDate)}</Pill>
        ) : (
          <span className="faint small">—</span>
        ),
    },
    {
      key: 'origin',
      header: 'Origen',
      cell: (item) => (
        <>
          {item.apiaryCode ?? item.originName}
          <div className="xs faint mono">{item.originCode ?? 'sin RENAPA'}</div>
        </>
      ),
    },
    {
      key: 'destination',
      header: 'Destino',
      cell: (item) => (
        <>
          {item.destinationName}
          <div className="xs faint mono">{item.destinationCode ?? 'sin código'}</div>
        </>
      ),
    },
    {
      key: 'quantity',
      header: 'Alzas',
      align: 'right',
      cell: (item) =>
        item.confirmedQuantity !== null && item.confirmedQuantity !== undefined
          ? `${item.confirmedQuantity} de ${item.declaredQuantity ?? '—'}`
          : (item.declaredQuantity ?? '—'),
    },
    {
      key: 'dates',
      header: 'Carga → vence',
      cell: (item) => (
        <span className="nowrap">
          {formatDay(item.loadDate)} → {formatDay(item.expiryDate)}
        </span>
      ),
    },
    {
      key: 'mode',
      header: 'Canal',
      role: 'hidden',
      cell: (item) =>
        item.issueMode === 'SIMULADO' ? (
          <Pill tone="warning">Simulado</Pill>
        ) : (
          <span className="small muted">{item.movementCode}</span>
        ),
    },
  ];

  return (
    <div className="stack">
      <PageHeader
        title={receiverRole ? 'DT-e recibidos' : 'DT-e'}
        help="dteList"
        actions={
          canIssue && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Nuevo DT-e
            </Button>
          )
        }
      />

      <ResourceNotices resource={list} />

      {integration && (
        <Notice
          tone={integration.mode === 'simulado' ? 'warning' : 'info'}
          title={`Canal de emisión: ${INTEGRATION_MODES.label(integration.mode)}`}
        >
          {integration.description}
        </Notice>
      )}

      {data && data.blockedHolders.length > 0 && (
        <Notice tone="danger" title="Emisión bloqueada por DT-e caducados">
          {data.blockedHolders.map((holder) => holder.businessName).join(', ')}: SIGSA no permite
          emitir nuevos DT-e hasta regularizar ante SENASA.
        </Notice>
      )}

      {data && (
        <div className="grid c4">
          {perspective === 'recibidos' ? (
            <>
              <Stat
                label="Por cerrar"
                value={data.tasks.pendingClosure}
                hint="vigentes o vencidos"
              />
              <Stat
                label="Vencidos"
                value={data.received.VENCIDO ?? 0}
                hint="cerralos antes de que caduquen"
              />
              <Stat label="Cerrados" value={data.received.CERRADO ?? 0} hint="arribo confirmado" />
              <Stat label="Sin arribo" value={data.received.SIN_ARRIBO ?? 0} hint="declarados" />
            </>
          ) : (
            <>
              <Stat label="Borradores" value={data.issued.BORRADOR ?? 0} hint="falta emitir" />
              <Stat
                label="Vigentes"
                value={data.issued.VIGENTE ?? 0}
                hint="aptos para transitar"
                help="dteValidity"
              />
              <Stat
                label="Vencidos"
                value={data.issued.VENCIDO ?? 0}
                hint="sin cierre de la sala"
              />
              <Stat label="Caducados" value={data.tasks.lapsed} hint="bloquean nuevas emisiones" />
            </>
          )}
        </div>
      )}

      <div className="filters">
        <select
          value={perspective}
          onChange={(event) => update({ perspective: event.target.value })}
          aria-label="Qué DT-e ver"
        >
          {PERSPECTIVES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => update({ status: event.target.value || null })}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {DTE_STATUS_FILTERS.map((option) => (
            <option key={option} value={option}>
              {statusInfo(option).label}
            </option>
          ))}
        </select>
        <select
          value={mine ? 'true' : ''}
          onChange={(event) => update({ mine: event.target.value || null })}
          aria-label="De quién"
        >
          <option value="">De mi organización</option>
          <option value="true">Solo los que pedí yo</option>
        </select>
        {(status || mine) && (
          <Button size="sm" icon="close" onClick={() => update({ status: null, mine: null })}>
            Quitar filtros
          </Button>
        )}
      </div>

      <Card flush>
        <DataList
          items={list.data?.data ?? []}
          columns={columns}
          rowKey={(item) => item.id}
          rowHref={(item) => `/dte/${item.id}`}
          loading={list.loading}
          total={list.data?.meta.total}
          onLoadMore={() => setPageSize((size) => size + 25)}
          loadingMore={list.loading}
          empty={
            <EmptyState
              icon="document"
              title={status ? 'No hay DT-e en ese estado' : 'Todavía no hay DT-e'}
              description={
                perspective === 'recibidos'
                  ? 'Cuando un productor emita un DT-e hacia tu sala, va a aparecer acá para cerrarlo.'
                  : 'El DT-e ampara el traslado de alzas melarias del apiario a la sala de extracción.'
              }
              action={
                canIssue && !status ? (
                  <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                    Preparar un DT-e
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </Card>

      {creating && (
        <NewDteWizard
          canRequest={Boolean(integration?.capabilities.emit)}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            list.reload();
            summary.reload();
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   Asistente: preparar, verificar y emitir
   ========================================================================= */

const STEP_NAMES = ['Origen y destino', 'Alzas y fechas', 'Transporte', 'Verificar y emitir'];

/**
 * El DT-e se arma en cuatro preguntas: de dónde a dónde, cuántas alzas y
 * cuándo, en qué vehículo, y si SIGSA lo aceptaría. La última etapa corre la
 * misma verificación que haría SIGSA y ofrece tres salidas: guardar el
 * borrador, pedirlo por API (si el canal lo permite) o registrar uno ya
 * emitido en SIGSA.
 */
const NewDteWizard = ({
  canRequest,
  onClose,
  onDone,
}: {
  canRequest: boolean;
  onClose: () => void;
  onDone: () => void;
}) => {
  const navigate = useNavigate();
  const feedback = useWriteFeedback();
  // Patentes habituales guardadas en Configuracion: se precargan, siempre editables.
  const { preferences } = usePreferences();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<'draft' | 'request' | 'manual' | null>(null);
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const [preflight, setPreflight] = useState<DtePreflight | null>(null);
  const [checking, setChecking] = useState(false);
  const [offline, setOffline] = useState(false);

  const apiaries = useResource<Paginated<Apiary>>('/apiaries?pageSize=100');
  const receivers = useResource<Paginated<Receiver>>('/establishments/receivers?pageSize=100');
  const today = todayAr();

  const fields: FieldSpec[] = useMemo(
    () => [
      // ---------------------------------------------------------- paso 1
      {
        name: 'apiaryId',
        label: 'Apiario de origen',
        type: 'select',
        required: true,
        full: true,
        help: 'renapaApiary',
        options: (apiaries.data?.data ?? []).map((item) => ({
          value: item.id,
          label: `${item.code}${item.name ? ` — ${item.name}` : ''} · ${
            item.renapaCode ? `RENAPA ${item.renapaCode}` : 'sin RENAPA'
          }`,
        })),
      },
      {
        name: 'destinationEstablishmentId',
        label: 'Sala de extracción',
        type: 'select',
        required: true,
        full: true,
        help: 'senasaSala',
        options: (receivers.data?.data ?? []).map((item) => ({
          value: item.id,
          label: `${item.name} · ${item.senasaCode ?? 'sin código SENASA'} (${item.organizationName})`,
        })),
      },
      // ---------------------------------------------------------- paso 2
      {
        name: 'estimatedQuantity',
        label: 'Alzas que estimás cosechar',
        type: 'number',
        min: '1',
        step: '1',
        inputMode: 'numeric',
      },
      {
        name: 'declaredQuantity',
        label: 'Alzas a declarar',
        type: 'number',
        min: '1',
        step: '1',
        required: true,
        inputMode: 'numeric',
        help: 'dteDeclared',
        validate: (value, all) =>
          all.estimatedQuantity && Number(value) < Number(all.estimatedQuantity)
            ? 'No puede ser menor que lo estimado: la sala no podrá confirmar más de lo declarado.'
            : null,
      },
      {
        name: 'loadDate',
        label: 'Fecha de carga',
        type: 'date',
        required: true,
        defaultValue: today,
        help: 'dteValidity',
      },
      {
        name: 'expiryDate',
        label: 'Vence',
        type: 'date',
        required: true,
        defaultValue: addDaysIso(today, DEFAULT_VALIDITY_DAYS),
        validate: (value, all) => {
          if (!all.loadDate) return null;
          const days = daysBetweenIso(all.loadDate, value);
          return days < DEFAULT_VALIDITY_DAYS || days > MAX_VALIDITY_DAYS
            ? `Tiene que ser entre ${DEFAULT_VALIDITY_DAYS} y ${MAX_VALIDITY_DAYS} días después de la carga.`
            : null;
        },
      },
      // ---------------------------------------------------------- paso 3
      {
        name: 'transportType',
        label: 'Vehículo',
        type: 'select',
        required: true,
        defaultValue: 'CAMIONETA',
        options: TRANSPORT_TYPES.options,
      },
      {
        name: 'transportPlate',
        label: 'Patente',
        required: true,
        placeholder: 'AA123BC',
        autoComplete: 'off',
        defaultValue: preferences.vehiclePlate,
      },
      {
        name: 'transportTrailerPlate',
        label: 'Patente del acoplado',
        placeholder: 'Si lleva acoplado',
        autoComplete: 'off',
        defaultValue: preferences.trailerPlate,
      },
      // ---------------------------------------------------------- manual
      { name: 'number', label: 'Número de DT-e', placeholder: '022440451-4', full: true },
      {
        name: 'verificationCode',
        label: 'Código de cierre',
        placeholder: '790112',
        help: 'dteVerificationCode',
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiaries.data, receivers.data, preferences.vehiclePlate, preferences.trailerPlate],
  );

  const { values, set, setValues, blur, errors, setErrors, validateAll } = useForm(fields);
  const byName = (name: string) => fields.find((field) => field.name === name)!;
  const pick = (names: string[]) => names.map(byName);

  const stepFields = [
    ['apiaryId', 'destinationEstablishmentId'],
    ['estimatedQuantity', 'declaredQuantity', 'loadDate', 'expiryDate'],
    ['transportType', 'transportPlate', 'transportTrailerPlate'],
    [],
  ];

  /** Al estimar, se propone declarar con margen: la sala no puede confirmar de mas. */
  const onEstimated = (value: string) => {
    setValues((current) => {
      const previous = current.estimatedQuantity
        ? suggestDeclared(Number(current.estimatedQuantity))
        : null;
      const untouched = !current.declaredQuantity || Number(current.declaredQuantity) === previous;
      return {
        ...current,
        estimatedQuantity: value,
        declaredQuantity:
          untouched && Number(value) > 0
            ? String(suggestDeclared(Number(value)))
            : current.declaredQuantity,
      };
    });
  };

  /** La fecha de vencimiento acompana a la de carga mientras nadie la toque. */
  const onLoadDate = (value: string) => {
    setValues((current) => {
      const previousDefault = current.loadDate
        ? addDaysIso(current.loadDate, DEFAULT_VALIDITY_DAYS)
        : null;
      return {
        ...current,
        loadDate: value,
        expiryDate:
          !current.expiryDate || current.expiryDate === previousDefault
            ? addDaysIso(value, DEFAULT_VALIDITY_DAYS)
            : current.expiryDate,
      };
    });
  };

  const body = (extra: Record<string, unknown> = {}) => ({
    apiaryId: values.apiaryId,
    destinationEstablishmentId: values.destinationEstablishmentId,
    ...(values.estimatedQuantity ? { estimatedQuantity: Number(values.estimatedQuantity) } : {}),
    declaredQuantity: Number(values.declaredQuantity),
    loadDate: values.loadDate,
    expiryDate: values.expiryDate,
    transport: {
      type: values.transportType,
      plate: values.transportPlate,
      ...(values.transportTrailerPlate ? { trailerPlate: values.transportTrailerPlate } : {}),
    },
    ...extra,
  });

  // La verificacion corre al llegar al ultimo paso y cada vez que se vuelve a el.
  useEffect(() => {
    if (step !== 3) return;
    let cancelled = false;
    setChecking(true);
    setOffline(false);
    setPreflight(null);
    apiSend<DtePreflight>('POST', '/dte/preflight', body(), {
      label: 'Verificación de DT-e',
      entity: '/dte',
      queueOffline: false,
    })
      .then((result) => {
        if (!cancelled && !result.queued) setPreflight(result.data);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof NetworkError) setOffline(true);
        else {
          const message = toUserMessage(cause, 'read');
          setFailure({ title: message.title, detail: message.detail });
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const next = () => {
    if (!validateAll(stepFields[step])) return;
    setFailure(null);
    setStep((current) => current + 1);
  };

  const back = () => {
    if (step === 0) onClose();
    else setStep((current) => current - 1);
  };

  const send = async (kind: 'draft' | 'request' | 'manual') => {
    if (!validateAll(stepFields.flat())) return;
    if (kind === 'manual' && !values.number?.trim()) {
      setErrors((current) => ({ ...current, number: 'Completá el número que figura en el DT-e.' }));
      return;
    }
    setBusy(kind);
    setFailure(null);
    try {
      const extra =
        kind === 'request'
          ? { submit: true }
          : kind === 'manual'
            ? {
                number: values.number.trim(),
                ...(values.verificationCode
                  ? { verificationCode: values.verificationCode.trim() }
                  : {}),
              }
            : {};
      const result = await apiSend<Dte>('POST', '/dte', body(extra), {
        label: `DT-e de ${values.declaredQuantity} alzas (${formatDay(values.loadDate)})`,
        entity: '/dte',
      });
      if (result.queued) {
        feedback.queued('El DT-e');
        onDone();
        return;
      }
      feedback.saved(
        kind === 'request'
          ? 'Emisión solicitada a SIGSA'
          : kind === 'manual'
            ? `DT-e ${result.data.number} registrado`
            : 'Borrador guardado',
      );
      onDone();
      navigate(`/dte/${result.data.id}`);
    } catch (cause) {
      const perField = fieldErrors(
        cause,
        fields.map((field) => field.name),
      );
      if (Object.keys(perField).length > 0) {
        setErrors((current) => ({ ...current, ...perField }));
        const firstBad = Object.keys(perField)[0];
        const target = stepFields.findIndex((group) => group.includes(firstBad));
        if (target >= 0) setStep(target);
      } else {
        const message = toUserMessage(cause, 'write');
        setFailure({ title: message.title, detail: message.detail });
      }
    } finally {
      setBusy(null);
    }
  };

  const label = (name: string) =>
    byName(name).options?.find((option) => option.value === values[name])?.label ?? '—';

  return (
    <Sheet
      title="Nuevo DT-e"
      subtitle="Traslado de alzas melarias del apiario a la sala (API-SEM)"
      onClose={onClose}
    >
      <Steps names={STEP_NAMES} current={step} />

      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (step < 3) next();
        }}
        noValidate
      >
        {failure && <FormError title={failure.title} detail={failure.detail} />}

        {step === 0 && (
          <>
            <Fields
              fields={pick(stepFields[0])}
              values={values}
              errors={errors}
              onChange={set}
              onBlur={blur}
            />
            {apiaries.data && apiaries.data.data.every((item) => !item.renapaCode) && (
              <Notice tone="warning" title="Tus apiarios no tienen RENAPA cargado">
                El RENAPA del apiario es el origen oficial del DT-e. Cargalo desde Apiarios →
                RENAPA.
              </Notice>
            )}
            <WizardActions onBack={back} onNext={next} nextLabel="Continuar" />
          </>
        )}

        {step === 1 && (
          <>
            <div className="form-grid">
              <Field
                spec={byName('estimatedQuantity')}
                value={values.estimatedQuantity ?? ''}
                error={errors.estimatedQuantity}
                onChange={onEstimated}
                onBlur={() => blur('estimatedQuantity')}
              />
              <Field
                spec={byName('declaredQuantity')}
                value={values.declaredQuantity ?? ''}
                error={errors.declaredQuantity}
                onChange={(value) => set('declaredQuantity', value)}
                onBlur={() => blur('declaredQuantity')}
              />
              <Field
                spec={byName('loadDate')}
                value={values.loadDate ?? ''}
                error={errors.loadDate}
                onChange={onLoadDate}
                onBlur={() => blur('loadDate')}
              />
              <Field
                spec={byName('expiryDate')}
                value={values.expiryDate ?? ''}
                error={errors.expiryDate}
                onChange={(value) => set('expiryDate', value)}
                onBlur={() => blur('expiryDate')}
              />
            </div>
            <Notice tone="info" title="Declará de más, nunca de menos">
              Si a la sala llegan más alzas que las declaradas, el DT-e se anula y hay que emitir
              otro antes de descargar. Declarar de más no tiene penalidad.
            </Notice>
            <WizardActions onBack={back} onNext={next} nextLabel="Continuar" />
          </>
        )}

        {step === 2 && (
          <>
            <Fields
              fields={pick(stepFields[2])}
              values={values}
              errors={errors}
              onChange={set}
              onBlur={blur}
            />
            <p className="small muted">
              El movimiento API-SEM no lleva precintos ni requiere transporte habilitado por SENASA.
            </p>
            <WizardActions onBack={back} onNext={next} nextLabel="Verificar" />
          </>
        )}

        {step === 3 && (
          <>
            <SummaryList
              rows={[
                { key: 'Origen', value: label('apiaryId') },
                { key: 'Destino', value: label('destinationEstablishmentId') },
                {
                  key: 'Alzas',
                  value: `${values.declaredQuantity} declaradas${
                    values.estimatedQuantity ? ` (${values.estimatedQuantity} estimadas)` : ''
                  }`,
                },
                {
                  key: 'Vigencia',
                  value: `${formatDay(values.loadDate)} → ${formatDay(values.expiryDate)}`,
                },
                {
                  key: 'Transporte',
                  value: `${TRANSPORT_TYPES.label(values.transportType)} ${values.transportPlate}${
                    values.transportTrailerPlate ? ` + ${values.transportTrailerPlate}` : ''
                  }`,
                },
              ]}
            />

            <div className="form-section-title" style={{ marginTop: 'var(--sp-5)' }}>
              Lo que SIGSA va a revisar
            </div>
            {checking && <p className="small muted">Verificando…</p>}
            {offline && (
              <Notice tone="warning" title="Sin conexión">
                No se pudo verificar. Podés guardar el borrador: se envía al volver la señal y lo
                verificás antes de emitir.
              </Notice>
            )}
            {preflight && <DteChecks checks={preflight.checks} />}

            <Disclosure label="Ya lo emití en SIGSA: registrar número y código de cierre">
              <Field
                spec={byName('number')}
                value={values.number ?? ''}
                error={errors.number}
                onChange={(value) => set('number', value)}
              />
              <Field
                spec={byName('verificationCode')}
                value={values.verificationCode ?? ''}
                error={errors.verificationCode}
                onChange={(value) => set('verificationCode', value)}
              />
              <Button
                variant="secondary"
                icon="check"
                busy={busy === 'manual'}
                busyLabel="Registrando…"
                disabled={Boolean(busy)}
                onClick={() => void send('manual')}
              >
                Registrar DT-e emitido
              </Button>
            </Disclosure>

            <div className="form-actions">
              <Button variant="ghost" icon="back" onClick={back} disabled={Boolean(busy)}>
                Volver
              </Button>
              <Button
                variant={canRequest && preflight?.ok ? 'secondary' : 'primary'}
                busy={busy === 'draft'}
                busyLabel="Guardando…"
                disabled={Boolean(busy)}
                onClick={() => void send('draft')}
              >
                Guardar borrador
              </Button>
              {canRequest && (
                <Button
                  variant="primary"
                  icon="send"
                  busy={busy === 'request'}
                  busyLabel="Enviando…"
                  disabled={Boolean(busy) || !preflight?.ok}
                  onClick={() => void send('request')}
                >
                  Pedir a SIGSA
                </Button>
              )}
            </div>
          </>
        )}
      </form>
    </Sheet>
  );
};
