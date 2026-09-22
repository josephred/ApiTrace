import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { apiSend } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { formatDateTime, formatQuantity, toLocalInput } from '../lib/format';
import {
  ISSUE_MODES,
  MATERIAL_TYPES,
  MOVEMENT_TYPES,
  TRANSPORT_TYPES,
  eventLabel,
} from '../lib/vocabulary';
import {
  DEFAULT_VALIDITY_DAYS,
  MAX_VALIDITY_DAYS,
  addDaysIso,
  daysBetweenIso,
  formatDay,
  todayAr,
} from '../lib/dte';
import type { IconName } from '../components/Icon';
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
import type { AuthUser, Movement, TimelineEvent, UserRole } from '../lib/types';

type ActionKey = 'dte' | 'manageDte' | 'dispatch' | 'receive' | 'close' | 'cancel';

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
  /** Cuerpo a medida (p. ej. el transporte del DT-e viaja anidado). */
  toBody?: (values: Record<string, string>) => Record<string, unknown>;
  /** Si esta presente, la accion es ir a otra pantalla y no un formulario. */
  href?: string;
}

/** Roles que tienen la pantalla de DT-e (la misma lista que App.tsx). */
const DTE_ROLES: UserRole[] = ['PRODUCTOR', 'SALA', 'ACOPIADOR', 'AUDITOR'];

/**
 * Traslado apiario -> sala: su documento es un DT-e API-SEM (alzas, fechas de
 * carga y vencimiento, transporte). Es la misma condicion que usa el backend
 * (DteService.isApiSem).
 */
const isApiSemMovement = (movement: Movement): boolean =>
  movement.requiredDocumentType === 'DTE' ||
  (movement.materialType === 'MATERIAL_MELARIO' &&
    movement.destination?.type === 'SALA_EXTRACCION');

const optional = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined);

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
const buildActions = (movement: Movement, user: AuthUser | null): ActionSpec[] => {
  const dte = movement.dte;
  const apiSem = isApiSemMovement(movement);
  const isAdmin = user?.role === 'ADMIN';
  // Emite y anula la organizacion del origen; cierra la del destino (dte.access.ts).
  const isIssuer =
    isAdmin || (Boolean(user?.organizationId) && user?.organizationId === movement.origin?.organizationId);
  const isReceiver =
    isAdmin ||
    (Boolean(user?.organizationId) && user?.organizationId === movement.destination?.organizationId);
  const loadDefault = todayAr(new Date(movement.scheduledAt));
  const alzas = movement.unit === 'ALZA' ? String(Math.ceil(Number(movement.quantity))) : '';
  const receivedAlzas =
    movement.reception && movement.reception.unit === 'ALZA'
      ? String(Math.round(Number(movement.reception.receivedQuantity)))
      : '';

  const dteApiSem: ActionSpec = {
    key: 'dte',
    label: 'Preparar DT-e',
    icon: 'document',
    title: 'Preparar DT-e (API-SEM)',
    path: `/movements/${movement.id}/dte`,
    submit: 'Guardar DT-e',
    busyLabel: 'Guardando…',
    notice:
      'Declará de más, nunca de menos: la sala no puede confirmar más alzas que las declaradas. Si ya lo emitiste en SIGSA, cargá número y código de cierre; si no, queda en borrador y lo emitís desde la pantalla del DT-e.',
    fields: [
      {
        name: 'declaredQuantity',
        label: 'Alzas declaradas',
        type: 'number',
        min: '1',
        step: '1',
        required: true,
        inputMode: 'numeric',
        help: 'dteDeclared',
        defaultValue: alzas,
      },
      {
        name: 'loadDate',
        label: 'Fecha de carga',
        type: 'date',
        required: true,
        help: 'dteValidity',
        defaultValue: loadDefault,
      },
      {
        name: 'expiryDate',
        label: 'Vence',
        type: 'date',
        required: true,
        defaultValue: addDaysIso(loadDefault, DEFAULT_VALIDITY_DAYS),
        validate: (value, all) => {
          if (!all.loadDate) return null;
          const days = daysBetweenIso(all.loadDate, value);
          return days < DEFAULT_VALIDITY_DAYS || days > MAX_VALIDITY_DAYS
            ? `Entre ${DEFAULT_VALIDITY_DAYS} y ${MAX_VALIDITY_DAYS} días después de la carga.`
            : null;
        },
      },
      {
        name: 'transportType',
        label: 'Vehículo',
        type: 'select',
        required: true,
        defaultValue: 'CAMIONETA',
        options: TRANSPORT_TYPES.options,
      },
      { name: 'transportPlate', label: 'Patente', required: true, placeholder: 'AA123BC' },
      { name: 'number', label: 'Número de DT-e (si ya lo emitiste)', placeholder: '022440451-4' },
      {
        name: 'verificationCode',
        label: 'Código de cierre',
        placeholder: '790112',
        help: 'dteVerificationCode',
      },
    ],
    toBody: (values) => ({
      declaredQuantity: Number(values.declaredQuantity),
      loadDate: values.loadDate,
      expiryDate: values.expiryDate,
      transport: { type: values.transportType, plate: values.transportPlate.trim() },
      number: optional(values.number),
      verificationCode: optional(values.verificationCode),
    }),
  };

  const dteOther: ActionSpec = {
    key: 'dte',
    label: 'Registrar documento',
    icon: 'document',
    title: 'Registrar documento',
    path: `/movements/${movement.id}/dte`,
    submit: 'Registrar documento',
    busyLabel: 'Registrando…',
    notice:
      'El documento queda registrado acá. Si todavía no tenés el número, dejalo vacío: queda en borrador.',
    fields: [
      {
        name: 'number',
        label: 'Número del documento',
        full: true,
        hint: 'Si todavía no lo tenés, dejalo vacío.',
      },
      {
        name: 'issuedAt',
        label: 'Fecha de emisión',
        type: 'datetime-local',
        full: true,
        defaultValue: toLocalInput(),
      },
    ],
  };

  const closeApiSem: ActionSpec = {
    key: 'close',
    label: 'Cerrar DT-e',
    icon: 'check',
    title: 'Cerrar DT-e en sala',
    path: `/movements/${movement.id}/dte/close`,
    submit: 'Cerrar DT-e',
    busyLabel: 'Cerrando…',
    notice: `Declarado: ${dte?.declaredQuantity ?? '—'} alzas. Copiá el código de cierre del DT-e impreso que trae el transportista.`,
    fields: [
      { name: 'number', label: 'Número impreso', full: true, defaultValue: dte?.number ?? '' },
      {
        name: 'verificationCode',
        label: 'Código de cierre impreso',
        required: Boolean(dte?.hasVerificationCode),
        help: 'dteVerificationCode',
        autoComplete: 'off',
      },
      {
        name: 'confirmedQuantity',
        label: 'Alzas recibidas',
        type: 'number',
        min: '0',
        step: '1',
        inputMode: 'numeric',
        required: dte?.declaredQuantity !== null && dte?.declaredQuantity !== undefined,
        defaultValue: receivedAlzas,
        validate: (value) =>
          dte?.declaredQuantity !== null &&
          dte?.declaredQuantity !== undefined &&
          Number(value) > dte.declaredQuantity
            ? `Supera las ${dte.declaredQuantity} declaradas: hay que anular y emitir otro DT-e.`
            : null,
      },
      { name: 'notes', label: 'Observaciones', type: 'textarea', full: true },
    ],
    toBody: (values) => ({
      number: optional(values.number),
      verificationCode: optional(values.verificationCode),
      confirmedQuantity:
        values.confirmedQuantity && values.confirmedQuantity.trim()
          ? Number(values.confirmedQuantity)
          : undefined,
      notes: optional(values.notes),
    }),
  };

  const specs: Record<ActionKey, ActionSpec> = {
    dte: apiSem ? dteApiSem : dteOther,
    manageDte: {
      key: 'manageDte',
      label: 'Ir al DT-e',
      icon: 'document',
      title: 'DT-e',
      path: '',
      submit: '',
      busyLabel: '',
      fields: [],
      href: dte ? `/dte/${dte.id}` : undefined,
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
      notice:
        apiSem && dte?.declaredQuantity
          ? `El DT-e declara ${dte.declaredQuantity} alzas: si llegaron más, el productor tiene que anular el DT-e y emitir otro antes de descargar. Si llegó otra cantidad, explicá por qué.`
          : `En origen se declararon ${formatQuantity(movement.quantity, movement.unit)}. Si llegó otra cantidad, hay que explicar por qué.`,
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
    close: apiSem
      ? closeApiSem
      : {
          key: 'close',
          label: 'Cerrar documento',
          icon: 'check',
          title: 'Cerrar documento',
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
  // Un DT-e anulado o eliminado ya no ampara nada: se puede preparar otro.
  const dteInPlay = dte && !['ANULADO', 'ELIMINADO', 'RECHAZADO'].includes(dte.status);
  const canCreateDte = !dteInPlay && (!apiSem || isIssuer);
  // Con DT-e API-SEM solo se transita si esta VIGENTE (semaforo de transito).
  const blockedByDte = apiSem && movement.requiresDocument && dteInPlay && !dte?.aptForTransit;
  const closable = dte
    ? apiSem
      ? ['VIGENTE', 'VENCIDO'].includes(dte.status)
      : dte.status === 'EMITIDO'
    : false;

  if (movement.status === 'DRAFT') {
    // Sin el documento que la norma exige no se puede despachar: ofrecerlo
    // primero evita que alguien intente el paso siguiente y choque con un error.
    if (movement.requiresDocument && !dteInPlay) {
      if (canCreateDte) available.push('dte');
    } else if (blockedByDte) {
      available.push('manageDte', 'dispatch');
    } else {
      available.push('dispatch');
      if (canCreateDte) available.push('dte');
    }
    available.push('cancel');
  } else if (movement.status === 'DISPATCHED' || movement.status === 'IN_TRANSIT') {
    available.push('receive');
    if (canCreateDte) available.push('dte');
    available.push('cancel');
  } else if (movement.status === 'RECEIVED' || movement.status === 'PARTIALLY_RECEIVED') {
    if (closable && isReceiver) available.push('close');
  }

  return available.map((key) => specs[key]);
};

/* =========================================================================
   Pantalla
   ========================================================================= */

export const MovementDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { canWrite, user, hasRole } = useAuth();
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
  const actions = canWrite ? buildActions(data, user) : [];
  const apiSem = isApiSemMovement(data);
  const canOpenDte = hasRole(...DTE_ROLES);
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

      {/* Las alertas del DT-e las calcula el backend con la fecha de hoy. */}
      {(dte?.alerts ?? [])
        .filter((alert) => alert.code !== 'APTO_TRANSITO')
        .map((alert) => (
          <Notice key={alert.code} tone={alert.severity}>
            {alert.message}
          </Notice>
        ))}

      {/* ----------------------------------------- una acción principal */}
      {primary && (
        <Card>
          <div className="next-step">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>Siguiente paso</div>
              <div className="small muted">
                {primary.key === 'dte' &&
                  (apiSem
                    ? 'Prepará el DT-e: sin él no se puede despachar.'
                    : 'Registrá el documento para poder despachar.')}
                {primary.key === 'manageDte' &&
                  (dte?.status === 'EMITIDO'
                    ? `El DT-e se habilita el ${formatDay(dte.loadDate)} a las 00:00: antes no se puede despachar.`
                    : 'El DT-e todavía no habilita el tránsito: emitilo o reemplazalo.')}
                {primary.key === 'dispatch' && 'Confirmá la salida del establecimiento de origen.'}
                {primary.key === 'receive' && 'Registrá que llegó y en qué cantidad.'}
                {primary.key === 'close' && 'Cerrá el documento ahora que la recepción esta hecha.'}
                {primary.key === 'cancel' && 'Este movimiento todavía puede cancelarse.'}
              </div>
            </div>
            {primary.href ? (
              <ButtonLink variant="primary" to={primary.href} icon={primary.icon}>
                {primary.label}
              </ButtonLink>
            ) : (
              <Button variant="primary" icon={primary.icon} onClick={() => run(primary)}>
                {primary.label}
              </Button>
            )}
          </div>
          {others.length > 0 && (
            <div className="row" style={{ marginTop: 'var(--sp-4)' }}>
              {others.map((spec) =>
                spec.href ? (
                  <ButtonLink key={spec.key} size="sm" to={spec.href} icon={spec.icon}>
                    {spec.label}
                  </ButtonLink>
                ) : (
                  <Button
                    key={spec.key}
                    size="sm"
                    variant={spec.key === 'cancel' ? 'danger' : 'secondary'}
                    icon={spec.icon}
                    onClick={() => run(spec)}
                  >
                    {spec.label}
                  </Button>
                ),
              )}
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
          title="Documento sanitario"
          help="dte"
          actions={
            dte && canOpenDte ? (
              <ButtonLink size="sm" to={`/dte/${dte.id}`} icon="document">
                Ver DT-e
              </ButtonLink>
            ) : undefined
          }
        >
          {dte ? (
            <SummaryList
              rows={[
                {
                  key: 'Número',
                  value: dte.number ? (
                    <span className="mono">{dte.number}</span>
                  ) : (
                    <span className="faint">sin asignar</span>
                  ),
                },
                { key: 'Estado', value: <StatusPill status={dte.status} /> },
                ...(dte.isApiSem
                  ? [
                      {
                        key: 'Tránsito',
                        value: dte.aptForTransit ? (
                          <Pill tone="success" icon="check">
                            Apto para transitar
                          </Pill>
                        ) : (
                          <Pill tone="neutral">No habilita el tránsito</Pill>
                        ),
                      },
                      { key: 'Alzas declaradas', value: dte.declaredQuantity ?? '—' },
                      ...(dte.confirmedQuantity !== null && dte.confirmedQuantity !== undefined
                        ? [{ key: 'Alzas confirmadas', value: dte.confirmedQuantity }]
                        : []),
                      {
                        key: 'Carga → vence',
                        value: `${formatDay(dte.loadDate)} → ${formatDay(dte.expiryDate)}`,
                      },
                      {
                        key: 'Origen (RENAPA)',
                        value: <span className="mono">{dte.originCode ?? '—'}</span>,
                      },
                      {
                        key: 'Destino (sala)',
                        value: <span className="mono">{dte.destinationCode ?? '—'}</span>,
                      },
                    ]
                  : [
                      {
                        key: 'RENSPA origen',
                        value: <span className="mono">{dte.originRenspa ?? '—'}</span>,
                      },
                      {
                        key: 'RENSPA destino',
                        value: <span className="mono">{dte.destinationRenspa ?? '—'}</span>,
                      },
                    ]),
                { key: 'Canal', value: ISSUE_MODES.label(dte.issueMode) },
                { key: 'SIGSA', value: <StatusPill status={dte.syncStatus} /> },
                { key: 'Emitido', value: formatDateTime(dte.issuedAt) },
                { key: 'Cerrado', value: formatDateTime(dte.closedAt) },
              ]}
            />
          ) : (
            <p className="muted small">
              {data.requiresDocument
                ? 'Sin documento asociado. La norma vigente lo exige para este traslado.'
                : 'Sin documento asociado. La norma vigente no lo exige para este traslado.'}
            </p>
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
      const body = spec.toBody ? spec.toBody(values) : buildBody(values, spec.fields);
      const result = await apiSend('POST', spec.path, body, {
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
