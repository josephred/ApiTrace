import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiSend } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { formatDateTime, formatQuantity, toLocalInput } from '../lib/format';
import { formatDay } from '../lib/dte';
import { MATERIAL_TYPES, MOVEMENT_TYPES, eventLabel } from '../lib/vocabulary';
import type { IconName } from '../components/Icon';
import { TransitSemaphoreBadge } from '../components/TransitSemaphoreBadge';
import {
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorNotice,
  Notice,
  PageHeader,
  Pill,
  Sheet,
  SkeletonList,
  StatusPill,
  SummaryList,
  useWriteFeedback,
} from '../components/ui';
import { ResourceNotices } from '../components/ResourceNotices';
import { Fields, Form, FormError, buildBody, useForm, type FieldSpec } from '../components/Form';
import type { Movement, TimelineEvent } from '../lib/types';

type ActionKey = 'dte' | 'dispatch' | 'receive' | 'close' | 'cancel';

interface ActionSpec {
  key: ActionKey;
  label: string;
  icon: IconName;
  title: string;
  path: string;
  submit: string;
  busyLabel: string;
  notice?: string;
  fields: FieldSpec[];
}

/* =========================================================================
   Que se puede hacer, y que conviene hacer
   ========================================================================= */

/**
 * La maquina de estados del backend define, en cada momento, una sola
 * continuacion natural. La pantalla anterior mostraba hasta cinco botones, casi
 * todos con el mismo peso visual, y dejaba al usuario decidir cual era «el
 * siguiente». Aca esa decision la toma el sistema: una acción principal y el
 * resto, disponibles pero secundarias.
 */
const buildActions = (movement: Movement): ActionSpec[] => {
  const dte = movement.dte;
  const specs: Record<ActionKey, ActionSpec> = {
    dte: {
      key: 'dte',
      label: 'Registrar DT-e',
      icon: 'document',
      title: 'Registrar DT-e',
      path: `/movements/${movement.id}/dte`,
      submit: 'Registrar DT-e',
      busyLabel: 'Registrando…',
      notice:
        'Todavía no hay integración con SIGSA: el documento queda registrado acá y marcado como pendiente de envío.',
      fields: [
        {
          name: 'number',
          label: 'Número de DT-e',
          full: true,
          hint: 'Si todavía no lo tenés, dejalo vacío: queda en borrador hasta que SIGSA asigne número.',
        },
        {
          name: 'issuedAt',
          label: 'Fecha de emision',
          type: 'datetime-local',
          full: true,
          defaultValue: toLocalInput(),
        },
      ],
    },
    dispatch: {
      key: 'dispatch',
      label: 'Despachar',
      icon: 'send',
      title: 'Despachar movimiento',
      path: `/movements/${movement.id}/dispatch`,
      submit: 'Confirmar salida',
      busyLabel: 'Despachando…',
      fields: [
        {
          name: 'dispatchedAt',
          label: 'Fecha y hora de salida',
          type: 'datetime-local',
          required: true,
          full: true,
          defaultValue: toLocalInput(),
        },
      ],
    },
    receive: {
      key: 'receive',
      label: 'Registrar recepción',
      icon: 'inbox',
      title: 'Registrar recepción',
      path: `/movements/${movement.id}/receive`,
      submit: 'Confirmar recepción',
      busyLabel: 'Registrando…',
      notice: `En origen se declararon ${formatQuantity(movement.quantity, movement.unit)}. Si llegó otra cantidad, hay que explicar por qué.`,
      fields: [
        {
          name: 'receivedQuantity',
          label: 'Cantidad recibida',
          type: 'number',
          step: '0.001',
          min: '0',
          required: true,
          inputMode: 'decimal',
          defaultValue: movement.quantity,
        },
        {
          name: 'receivedAt',
          label: 'Fecha y hora',
          type: 'datetime-local',
          required: true,
          defaultValue: toLocalInput(),
        },
        {
          name: 'discrepancyNotes',
          label: 'Motivo de la diferencia',
          type: 'textarea',
          full: true,
          hint: 'Solo si la cantidad recibida no coincide con la declarada.',
          validate: (value, all) =>
            !value && all.receivedQuantity && Number(all.receivedQuantity) !== Number(movement.quantity)
              ? 'La cantidad no coincide con la declarada: explica brevemente por qué.'
              : null,
        },
      ],
    },
    close: {
      key: 'close',
      label: 'Cerrar DT-e',
      icon: 'check',
      title: 'Cerrar DT-e',
      path: `/movements/${movement.id}/dte/close`,
      submit: 'Cerrar documento',
      busyLabel: 'Cerrando…',
      notice: 'Lo cierra el establecimiento que recibió, una vez registrada la recepción.',
      fields: [
        {
          name: 'closedAt',
          label: 'Fecha y hora de cierre',
          type: 'datetime-local',
          required: true,
          full: true,
          defaultValue: toLocalInput(),
        },
      ],
    },
    cancel: {
      key: 'cancel',
      label: 'Cancelar movimiento',
      icon: 'close',
      title: 'Cancelar movimiento',
      path: `/movements/${movement.id}/cancel`,
      submit: 'Cancelar movimiento',
      busyLabel: 'Cancelando…',
      fields: [
        {
          name: 'reason',
          label: 'Motivo',
          type: 'textarea',
          required: true,
          full: true,
          hint: 'Queda registrado en el historial.',
        },
      ],
    },
  };

  const available: ActionKey[] = [];

  if (movement.status === 'DRAFT') {
    // Sin el documento que la norma exige no se puede despachar: ofrecerlo
    // primero evita que alguien intente el paso siguiente y choque con un error.
    if (movement.requiresDocument && !dte) available.push('dte');
    else {
      available.push('dispatch');
      if (!dte) available.push('dte');
    }
    available.push('cancel');
  } else if (movement.status === 'DISPATCHED' || movement.status === 'IN_TRANSIT') {
    available.push('receive');
    if (!dte) available.push('dte');
    available.push('cancel');
  } else if (movement.status === 'RECEIVED' || movement.status === 'PARTIALLY_RECEIVED') {
    if (dte && ['ISSUED', 'APPROVED'].includes(dte.status)) available.push('close');
  }

  return available.map((key) => specs[key]);
};

/* =========================================================================
   Pantalla
   ========================================================================= */

export const MovementDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { canWrite } = useAuth();
  const [action, setAction] = useState<ActionSpec | null>(null);
  const [confirming, setConfirming] = useState<ActionSpec | null>(null);

  const movement = useResource<Movement>(id ? `/movements/${id}` : null);
  const timeline = useResource<{ events: TimelineEvent[] }>(
    id ? `/traceability/timeline/movement/${id}` : null,
  );

  if (movement.loading) {
    return (
      <div className="stack">
        <PageHeader title="Movimiento" back={{ to: '/movements', label: 'Movimientos' }} />
        <Card flush>
          <SkeletonList rows={4} />
        </Card>
      </div>
    );
  }

  if (movement.error) {
    return (
      <div className="stack">
        <PageHeader title="Movimiento" back={{ to: '/movements', label: 'Movimientos' }} />
        <ErrorNotice message={movement.error} onRetry={movement.reload} />
      </div>
    );
  }

  if (!movement.data) return null;

  const data = movement.data;
  const dte = data.dte;
  const actions = canWrite ? buildActions(data) : [];
  const [primary, ...others] = actions;

  const reload = () => {
    movement.reload();
    timeline.reload();
  };

  const run = (spec: ActionSpec) => {
    // Cancelar destruye trabajo: se confirma antes de abrir el formulario.
    if (spec.key === 'cancel') setConfirming(spec);
    else setAction(spec);
  };

  return (
    <div className="stack">
      <PageHeader
        title={`${MOVEMENT_TYPES.label(data.movementType)} · ${formatQuantity(data.quantity, data.unit)}`}
        code={data.code}
        status={<StatusPill status={data.status} />}
        sub={`${data.origin?.name ?? '—'} → ${data.destination?.name ?? '—'}`}
        help="movements"
        back={{ to: '/movements', label: 'Movimientos' }}
        actions={
          <ButtonLink to={`/trace/forward/movement/${data.id}`} icon="trace">
            Ver trazabilidad
          </ButtonLink>
        }
      />

      <ResourceNotices resource={movement} />

      {data.requiresDocument && !dte && (
        <Notice tone="warning" title={`Falta el ${data.requiredDocumentType}`}>
          La norma vigente a la fecha del traslado lo exige. No se puede despachar hasta
          registrarlo.
        </Notice>
      )}

      {dte?.syncStatus === 'PENDING_SYNC' && (
        <Notice tone="info" title="El DT-e todavía no llegó a SIGSA">
          Esta registrado acá y no se pierde. Se enviará cuando exista la integración.
        </Notice>
      )}

      {/* ----------------------------------------- una acción principal */}
      {primary && (
        <Card>
          <div className="next-step">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>Siguiente paso</div>
              <div className="small muted">
                {primary.key === 'dte' && 'Registrá el documento para poder despachar.'}
                {primary.key === 'dispatch' && 'Confirmá la salida del establecimiento de origen.'}
                {primary.key === 'receive' && 'Registrá que llegó y en qué cantidad.'}
                {primary.key === 'close' && 'Cerrá el documento ahora que la recepción esta hecha.'}
                {primary.key === 'cancel' && 'Este movimiento todavía puede cancelarse.'}
              </div>
            </div>
            <Button variant="primary" icon={primary.icon} onClick={() => run(primary)}>
              {primary.label}
            </Button>
          </div>
          {others.length > 0 && (
            <div className="row" style={{ marginTop: 'var(--sp-4)' }}>
              {others.map((spec) => (
                <Button
                  key={spec.key}
                  size="sm"
                  variant={spec.key === 'cancel' ? 'danger' : 'secondary'}
                  icon={spec.icon}
                  onClick={() => run(spec)}
                >
                  {spec.label}
                </Button>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid c2">
        <Card title="Datos del traslado" help="scheduledAt">
          <SummaryList
            rows={[
              { key: 'Tipo', value: MOVEMENT_TYPES.label(data.movementType) },
              { key: 'Material', value: MATERIAL_TYPES.label(data.materialType) },
              {
                key: 'Sale de',
                value: (
                  <>
                    {data.origin?.name ?? '—'}
                    {data.originApiaryId && (
                      <div className="xs faint" style={{ fontWeight: 400 }}>
                        desde un apiario
                      </div>
                    )}
                  </>
                ),
              },
              { key: 'Llega a', value: data.destination?.name ?? '—' },
              { key: 'Cantidad', value: formatQuantity(data.quantity, data.unit) },
              { key: 'Programado', value: formatDateTime(data.scheduledAt) },
              { key: 'Despachado', value: formatDateTime(data.dispatchedAt) },
              { key: 'Recibido', value: formatDateTime(data.receivedAt) },
              ...(data.notes ? [{ key: 'Observaciones', value: data.notes }] : []),
            ]}
          />
        </Card>

        <Card
          title="Documento sanitario oficial"
          help="dte"
          actions={
            dte ? (
              <Link to={`/dte/${dte.id}`} className="small font-medium">
                Ver DT-e oficial →
              </Link>
            ) : undefined
          }
        >
          {dte ? (
            <div className="stack" style={{ gap: 'var(--sp-3)' }}>
              <div className="row row-tight" style={{ alignItems: 'center' }}>
                <TransitSemaphoreBadge
                  semaphore={dte.transitSemaphore}
                  reason={dte.transitReasonText}
                  size="sm"
                  showReason
                />
              </div>
              <SummaryList
                rows={[
                  {
                    key: 'Número Oficial',
                    value: dte.number ? (
                      <span className="mono font-medium">{dte.number}</span>
                    ) : (
                      <span className="faint">Borrador (S/N)</span>
                    ),
                  },
                  { key: 'Estado DT-e', value: <StatusPill status={dte.status} /> },
                  { key: 'Fecha de carga', value: formatDay(dte.loadDate) },
                  { key: 'Vencimiento', value: formatDay(dte.expiryDate) },
                  {
                    key: 'Cant. declarada (+15%)',
                    value: `${dte.declaredQuantity ?? 0} ${dte.unit ?? 'ALZA'}`,
                  },
                  {
                    key: 'Patente vehículo',
                    value: dte.transportPlate ? (
                      <span className="mono">{dte.transportPlate}</span>
                    ) : (
                      '—'
                    ),
                  },
                  {
                    key: 'Acceso oficial',
                    value: (
                      <Link to={`/dte/${dte.id}`} className="font-medium">
                        Gestionar DT-e oficial →
                      </Link>
                    ),
                  },
                ]}
              />
            </div>
          ) : (
            <div className="stack" style={{ gap: 'var(--sp-2)' }}>
              <p className="muted small">
                {data.requiresDocument
                  ? 'Sin documento asociado. La norma vigente lo exige para este traslado.'
                  : 'Sin documento asociado. La norma vigente no lo exige para este traslado.'}
              </p>
              {data.requiresDocument && canWrite && (
                <div>
                  <Link to="/dte" className="btn btn-secondary btn-sm">
                    Preparar DT-e oficial
                  </Link>
                </div>
              )}
            </div>
          )}

          {data.reception && (
            <>
              <div className="form-section-title" style={{ marginTop: 'var(--sp-5)' }}>
                Recepción
              </div>
              <SummaryList
                rows={[
                  { key: 'Fecha', value: formatDateTime(data.reception.receivedAt) },
                  {
                    key: 'Cantidad recibida',
                    value: (
                      <span className="row row-tight" style={{ justifyContent: 'flex-end' }}>
                        {formatQuantity(data.reception.receivedQuantity, data.reception.unit)}
                        {data.reception.hasDiscrepancy && (
                          <Pill tone="warning" icon="warning">
                            con diferencia
                          </Pill>
                        )}
                      </span>
                    ),
                  },
                  { key: 'Resultado', value: <StatusPill status={data.reception.result} /> },
                  ...(data.reception.discrepancyNotes
                    ? [{ key: 'Motivo', value: data.reception.discrepancyNotes }]
                    : []),
                ]}
              />
            </>
          )}
        </Card>
      </div>

      <Card title="Historial" help="audit">
        {timeline.data && timeline.data.events.length > 0 ? (
          <ul className="timeline">
            {timeline.data.events.map((event) => (
              <li key={event.id}>
                <div className="timeline-what">{eventLabel(event.eventType)}</div>
                <div className="timeline-when">
                  {formatDateTime(event.recordedAt)}
                  {event.occurredAt !== event.recordedAt && (
                    <> · ocurrio {formatDateTime(event.occurredAt)}</>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="audit"
            title="Sin eventos"
            description="Cada acción sobre este movimiento va a quedar registrada acá."
          />
        )}
      </Card>

      {confirming && (
        <ConfirmDialog
          title="Cancelar este movimiento"
          description={
            <>
              El movimiento <strong className="mono">{data.code}</strong> queda cancelado y no puede
              volver atrás. Vas a tener que indicar el motivo.
            </>
          }
          confirmLabel="Sí, cancelar"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const spec = confirming;
            setConfirming(null);
            setAction(spec);
          }}
        />
      )}

      {action && (
        <ActionSheet
          spec={action}
          movementCode={data.code}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            reload();
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   Formulario de acción
   ========================================================================= */

const ActionSheet = ({
  spec,
  movementCode,
  onClose,
  onDone,
}: {
  spec: ActionSpec;
  movementCode: string;
  onClose: () => void;
  onDone: () => void;
}) => {
  const { values, set, blur, errors, setErrors, validateAll } = useForm(spec.fields);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const feedback = useWriteFeedback();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateAll()) return;

    setBusy(true);
    setFailure(null);
    try {
      const result = await apiSend('POST', spec.path, buildBody(values, spec.fields), {
        label: `${spec.title} — ${movementCode}`,
        entity: '/movements',
      });
      if (result.queued) feedback.queued('La operación');
      else feedback.saved(`${spec.label} listo`, movementCode);
      onDone();
    } catch (cause) {
      const perField = fieldErrors(cause, spec.fields.map((field) => field.name));
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
    <Sheet title={spec.title} subtitle={movementCode} onClose={onClose}>
      {spec.notice && <Notice tone="info">{spec.notice}</Notice>}
      <Form
        onSubmit={submit}
        error={failure && <FormError title={failure.title} detail={failure.detail} />}
        submitLabel={spec.submit}
        busyLabel={spec.busyLabel}
        onCancel={onClose}
        busy={busy}
        cancelLabel="Volver"
      >
        <Fields fields={spec.fields} values={values} errors={errors} onChange={set} onBlur={blur} />
      </Form>
    </Sheet>
  );
};
