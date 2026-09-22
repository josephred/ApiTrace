import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiSend } from '../lib/api';
import { useResource } from '../lib/useResource';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { formatDateTime, formatQuantity, toLocalInput } from '../lib/format';
import {
  DEFAULT_VALIDITY_DAYS,
  MAX_VALIDITY_DAYS,
  daysBetweenIso,
  formatDay,
  transitLight,
} from '../lib/dte';
import { HISTORY_SOURCES, ISSUE_MODES, TRANSPORT_TYPES, statusInfo } from '../lib/vocabulary';
import type { IconName } from '../components/Icon';
import { Icon } from '../components/Icon';
import {
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  ErrorNotice,
  HelpTip,
  Notice,
  PageHeader,
  Sheet,
  SkeletonList,
  StatusPill,
  SummaryList,
  useWriteFeedback,
} from '../components/ui';
import { ResourceNotices } from '../components/ResourceNotices';
import { Fields, Form, FormError, useForm, type FieldSpec } from '../components/Form';
import type { DteAction, DteDetail } from '../lib/types';

/* =========================================================================
   Acciones
   ========================================================================= */

interface ActionSpec {
  key: Exclude<DteAction, 'print' | 'requestEmission'>;
  label: string;
  icon: IconName;
  title: string;
  method: 'POST' | 'PATCH';
  path: string;
  submit: string;
  notice?: string;
  fields: FieldSpec[];
  /** Arma el cuerpo: fechas de calendario, numeros y booleanos van tipados. */
  toBody: (values: Record<string, string>) => Record<string, unknown>;
}

const optional = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined);
const optionalNumber = (value: string | undefined) =>
  value && value.trim() ? Number(value) : undefined;
const isoOrUndefined = (value: string | undefined) =>
  value ? new Date(value).toISOString() : undefined;

const buildActions = (dte: DteDetail): Partial<Record<ActionSpec['key'], ActionSpec>> => {
  const base = `/dte/${dte.id}`;
  const receivedAlzas =
    dte.reception && dte.reception.unit === 'ALZA'
      ? String(Math.round(Number(dte.reception.receivedQuantity)))
      : '';

  return {
    edit: {
      key: 'edit',
      label: 'Editar borrador',
      icon: 'document',
      title: 'Editar borrador',
      method: 'PATCH',
      path: base,
      submit: 'Guardar cambios',
      fields: [
        {
          name: 'estimatedQuantity',
          label: 'Alzas estimadas',
          type: 'number',
          min: '1',
          step: '1',
          inputMode: 'numeric',
          defaultValue: dte.estimatedQuantity ? String(dte.estimatedQuantity) : '',
        },
        {
          name: 'declaredQuantity',
          label: 'Alzas declaradas',
          type: 'number',
          min: '1',
          step: '1',
          required: true,
          inputMode: 'numeric',
          help: 'dteDeclared',
          defaultValue: dte.declaredQuantity ? String(dte.declaredQuantity) : '',
          validate: (value, all) =>
            all.estimatedQuantity && Number(value) < Number(all.estimatedQuantity)
              ? 'No puede ser menor que lo estimado.'
              : null,
        },
        {
          name: 'loadDate',
          label: 'Fecha de carga',
          type: 'date',
          required: true,
          defaultValue: dte.loadDate ?? '',
        },
        {
          name: 'expiryDate',
          label: 'Vence',
          type: 'date',
          required: true,
          defaultValue: dte.expiryDate ?? '',
          validate: (value, all) => {
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
          options: TRANSPORT_TYPES.options,
          defaultValue: dte.transportType ?? 'CAMIONETA',
        },
        {
          name: 'transportPlate',
          label: 'Patente',
          required: true,
          defaultValue: dte.transportPlate ?? '',
        },
        {
          name: 'transportTrailerPlate',
          label: 'Patente del acoplado',
          defaultValue: dte.transportTrailerPlate ?? '',
        },
      ],
      toBody: (values) => ({
        estimatedQuantity: optionalNumber(values.estimatedQuantity),
        declaredQuantity: Number(values.declaredQuantity),
        loadDate: values.loadDate,
        expiryDate: values.expiryDate,
        transport: {
          type: values.transportType,
          plate: values.transportPlate,
          ...(optional(values.transportTrailerPlate)
            ? { trailerPlate: values.transportTrailerPlate }
            : {}),
        },
      }),
    },
    issueManual: {
      key: 'issueManual',
      label: 'Registrar número de SIGSA',
      icon: 'check',
      title: 'Registrar DT-e emitido en SIGSA',
      method: 'POST',
      path: `${base}/issue`,
      submit: 'Registrar',
      notice:
        'Copiá el número y el código de cierre tal como figuran en el DT-e emitido en SIGSA (web u oficina local).',
      fields: [
        {
          name: 'number',
          label: 'Número de DT-e',
          required: true,
          full: true,
          placeholder: '022440451-4',
        },
        {
          name: 'verificationCode',
          label: 'Código de cierre',
          placeholder: '790112',
          help: 'dteVerificationCode',
        },
        {
          name: 'issuedAt',
          label: 'Fecha de emisión',
          type: 'datetime-local',
          defaultValue: toLocalInput(),
        },
      ],
      toBody: (values) => ({
        number: values.number.trim(),
        verificationCode: optional(values.verificationCode),
        issuedAt: isoOrUndefined(values.issuedAt),
      }),
    },
    void: {
      key: 'void',
      label: dte.status === 'BORRADOR' || dte.status === 'SOLICITADO' ? 'Eliminar' : 'Anular',
      icon: 'close',
      title: 'Dar de baja el DT-e',
      method: 'POST',
      path: `${base}/void`,
      submit: 'Dar de baja',
      notice:
        'Si llegaron más alzas de las declaradas, anulalo y emití uno nuevo para el mismo traslado antes de descargar.',
      fields: [
        {
          name: 'reason',
          label: 'Motivo',
          type: 'textarea',
          required: true,
          full: true,
        },
        {
          name: 'feePaid',
          label: '¿Se abonó el arancel?',
          type: 'select',
          required: true,
          defaultValue: 'false',
          options: [
            { value: 'false', label: 'No: queda ELIMINADO' },
            { value: 'true', label: 'Sí: queda ANULADO' },
          ],
        },
      ],
      toBody: (values) => ({
        reason: values.reason.trim(),
        feePaid: values.feePaid === 'true',
      }),
    },
    close: {
      key: 'close',
      label: 'Cerrar DT-e (SITA)',
      icon: 'check',
      title: 'Cerrar DT-e en sala',
      method: 'POST',
      path: `${base}/close`,
      submit: 'Cerrar DT-e',
      notice: `Declarado: ${dte.declaredQuantity ?? '—'} alzas. La cantidad real no puede superarlo: si llegaron más, el productor tiene que anular y emitir otro DT-e.`,
      fields: [
        {
          name: 'number',
          label: 'Número impreso',
          full: true,
          defaultValue: dte.number ?? '',
        },
        {
          name: 'verificationCode',
          label: 'Código de cierre impreso',
          required: Boolean(dte.hasVerificationCode),
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
          required: dte.declaredQuantity !== null && dte.declaredQuantity !== undefined,
          defaultValue: receivedAlzas,
          validate: (value) =>
            dte.declaredQuantity !== null &&
            dte.declaredQuantity !== undefined &&
            Number(value) > dte.declaredQuantity
              ? `Supera las ${dte.declaredQuantity} declaradas: hay que anular y emitir otro DT-e.`
              : null,
        },
        {
          name: 'arrivalAt',
          label: 'Llegó',
          type: 'datetime-local',
          required: true,
          defaultValue: toLocalInput(
            dte.reception ? new Date(dte.reception.receivedAt) : new Date(),
          ),
        },
        { name: 'notes', label: 'Observaciones', type: 'textarea', full: true },
      ],
      toBody: (values) => ({
        number: optional(values.number),
        verificationCode: optional(values.verificationCode),
        confirmedQuantity: optionalNumber(values.confirmedQuantity),
        arrivalAt: isoOrUndefined(values.arrivalAt),
        notes: optional(values.notes),
      }),
    },
    noArrival: {
      key: 'noArrival',
      label: 'Declarar sin arribo',
      icon: 'warning',
      title: 'La carga no llegó',
      method: 'POST',
      path: `${base}/no-arrival`,
      submit: 'Declarar sin arribo',
      notice:
        'Genera un sumario administrativo en SENASA. Usalo solo si la carga no llegó a la sala.',
      fields: [
        {
          name: 'reason',
          label: 'Qué pasó',
          type: 'textarea',
          required: true,
          full: true,
        },
      ],
      toBody: (values) => ({ reason: values.reason.trim() }),
    },
    regularize: {
      key: 'regularize',
      label: 'Registrar regularización',
      icon: 'check',
      title: 'Regularización ante SENASA',
      method: 'POST',
      path: `${base}/regularize`,
      submit: 'Levantar bloqueo',
      notice:
        'Solo cuando SENASA confirmó la regularización. Levanta el bloqueo de emisión del titular.',
      fields: [
        {
          name: 'note',
          label: 'Constancia',
          type: 'textarea',
          required: true,
          full: true,
        },
      ],
      toBody: (values) => ({ note: values.note.trim() }),
    },
  };
};

/* =========================================================================
   Pantalla
   ========================================================================= */

export const DteDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const resource = useResource<DteDetail>(id ? `/dte/${id}` : null);
  const [action, setAction] = useState<ActionSpec | null>(null);
  const [confirmRequest, setConfirmRequest] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<{
    title: string;
    detail?: string;
  } | null>(null);
  const feedback = useWriteFeedback();

  if (resource.loading) {
    return (
      <div className="stack">
        <PageHeader title="DT-e" back={{ to: '/dte', label: 'DT-e' }} />
        <Card flush>
          <SkeletonList rows={4} />
        </Card>
      </div>
    );
  }

  if (resource.error || !resource.data) {
    return (
      <div className="stack">
        <PageHeader title="DT-e" back={{ to: '/dte', label: 'DT-e' }} />
        {resource.error && <ErrorNotice message={resource.error} onRetry={resource.reload} />}
      </div>
    );
  }

  const dte = resource.data;
  const specs = buildActions(dte);
  const light = transitLight(dte);
  const allowed = dte.allowedActions;
  const isIssuerView = dte.verificationCode !== null && dte.verificationCode !== undefined;

  const requestEmission = async () => {
    setRequesting(true);
    setRequestError(null);
    try {
      const result = await apiSend(
        'POST',
        `/dte/${dte.id}/issue`,
        {},
        {
          label: `Solicitud de DT-e a SIGSA`,
          entity: '/dte',
        },
      );
      if (result.queued) feedback.queued('La solicitud');
      else feedback.saved('Emisión solicitada a SIGSA', 'El número llega en unos segundos.');
      setConfirmRequest(false);
      resource.reload();
    } catch (cause) {
      const message = toUserMessage(cause, 'write');
      setRequestError({ title: message.title, detail: message.detail });
    } finally {
      setRequesting(false);
    }
  };

  const buttons = allowed.map((key) => {
    if (key === 'print') {
      return (
        <Button key={key} size="sm" icon="download" onClick={() => window.print()}>
          Imprimir constancia
        </Button>
      );
    }
    if (key === 'requestEmission') {
      return (
        <Button key={key} variant="primary" icon="send" onClick={() => setConfirmRequest(true)}>
          Pedir a SIGSA
        </Button>
      );
    }
    const spec = specs[key];
    if (!spec) return null;
    const primary =
      (key === 'close' && allowed.includes('close')) ||
      (key === 'issueManual' && !allowed.includes('requestEmission'));
    return (
      <Button
        key={key}
        size={primary ? 'md' : 'sm'}
        variant={
          primary ? 'primary' : key === 'void' || key === 'noArrival' ? 'danger' : 'secondary'
        }
        icon={spec.icon}
        onClick={() => setAction(spec)}
      >
        {spec.label}
      </Button>
    );
  });

  return (
    <div className="stack">
      <PageHeader
        title={dte.number ? `DT-e ${dte.number}` : 'DT-e sin número'}
        code={dte.movement.code}
        status={<StatusPill status={dte.status} />}
        sub={`${dte.apiary?.code ?? dte.origin.name} → ${dte.destination.name}`}
        back={{ to: '/dte', label: 'DT-e' }}
        actions={
          <ButtonLink to={`/movements/${dte.movement.id}`} icon="movements">
            Ver traslado
          </ButtonLink>
        }
      />

      <ResourceNotices resource={resource} />

      {/* ------------------------------------------------ semaforo de transito */}
      <section className={`card transit-light transit-${light.tone}`} aria-live="polite">
        <div className="transit-light-body">
          <Icon
            name={
              light.tone === 'success'
                ? 'checkCircle'
                : light.tone === 'danger'
                  ? 'danger'
                  : 'warning'
            }
            size={26}
          />
          <div>
            <div className="transit-light-title">{light.title}</div>
            <div className="small">{light.detail}</div>
          </div>
        </div>
        <HelpTip topic="dteValidity" />
      </section>

      {(dte.alerts ?? [])
        .filter((alert) => alert.code !== 'APTO_TRANSITO')
        .map((alert) => (
          <Notice key={alert.code} tone={alert.severity === 'success' ? 'success' : alert.severity}>
            {alert.message}
          </Notice>
        ))}

      {requestError && <FormError title={requestError.title} detail={requestError.detail} />}

      {buttons.length > 0 && (
        <Card>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {buttons}
          </div>
        </Card>
      )}

      <div className="grid c2">
        <Card title="Trámite API-SEM" help="dte">
          <SummaryList
            rows={[
              {
                key: 'Movimiento',
                value: `${dte.movementTypeCode ?? '—'} · ${dte.transitReason ?? '—'}`,
              },
              {
                key: 'Producto',
                value: `${dte.productCode ?? '—'} — ${dte.productName ?? '—'}`,
              },
              {
                key: 'Alzas',
                value: (
                  <>
                    {dte.declaredQuantity ?? '—'} declaradas
                    {dte.estimatedQuantity ? (
                      <div className="xs faint">{dte.estimatedQuantity} estimadas</div>
                    ) : null}
                    {dte.confirmedQuantity !== null && dte.confirmedQuantity !== undefined ? (
                      <div className="xs">{dte.confirmedQuantity} confirmadas por la sala</div>
                    ) : null}
                  </>
                ),
              },
              { key: 'Carga', value: formatDay(dte.loadDate) },
              { key: 'Vence', value: formatDay(dte.expiryDate) },
              ...(dte.window
                ? [
                    {
                      key: 'Cierre hasta',
                      value: formatDay(dte.window.lastClosingDate),
                    },
                  ]
                : []),
              { key: 'Canal', value: ISSUE_MODES.label(dte.issueMode) },
              { key: 'SIGSA', value: <StatusPill status={dte.syncStatus} /> },
              ...(dte.errorMessage ? [{ key: 'Detalle', value: dte.errorMessage }] : []),
              ...(dte.issuedAt ? [{ key: 'Emitido', value: formatDateTime(dte.issuedAt) }] : []),
              ...(dte.closedAt ? [{ key: 'Cerrado', value: formatDateTime(dte.closedAt) }] : []),
              ...(dte.voidReason ? [{ key: 'Motivo de baja', value: dte.voidReason }] : []),
            ]}
          />
        </Card>

        <Card title="Código de cierre" help="dteVerificationCode">
          {isIssuerView ? (
            <>
              <div className="code-box mono">{dte.verificationCode}</div>
              <p className="small muted">
                Va impreso en el DT-e. La sala lo pide para cerrarlo: no lo compartas por otro
                medio.
              </p>
            </>
          ) : dte.hasVerificationCode ? (
            <p className="small muted">
              Pedíselo al transportista: está impreso en el DT-e que acompaña la carga.
            </p>
          ) : (
            <p className="small muted">Todavía no hay código: se asigna al emitir.</p>
          )}
        </Card>

        <Card title="Origen" help="renapaApiary">
          <SummaryList
            rows={[
              {
                key: 'Apiario',
                value: dte.apiary
                  ? `${dte.apiary.code}${dte.apiary.name ? ` — ${dte.apiary.name}` : ''}`
                  : '—',
              },
              {
                key: 'RENAPA',
                value: (
                  <span className="row row-tight" style={{ justifyContent: 'flex-end' }}>
                    <span className="mono">{dte.originCode ?? dte.apiary?.renapaCode ?? '—'}</span>
                    {dte.apiary && <StatusPill status={dte.apiary.renapaStatus} withIcon={false} />}
                  </span>
                ),
              },
              {
                key: 'Titular',
                value: dte.holder
                  ? `${dte.holder.businessName}${dte.holder.taxId ? ` · CUIT ${dte.holder.taxId}` : ''}`
                  : '—',
              },
              { key: 'Predio', value: dte.origin.name },
            ]}
          />
        </Card>

        <Card title="Destino" help="senasaSala">
          <SummaryList
            rows={[
              { key: 'Sala', value: dte.destination.name },
              {
                key: 'Código SENASA',
                value: (
                  <span className="row row-tight" style={{ justifyContent: 'flex-end' }}>
                    <span className="mono">
                      {dte.destinationCode ?? dte.destination.senasaCode ?? '—'}
                    </span>
                    <StatusPill status={dte.destination.senasaStatus} withIcon={false} />
                  </span>
                ),
              },
              {
                key: 'Ubicación',
                value:
                  [dte.destination.locality, dte.destination.province].filter(Boolean).join(', ') ||
                  '—',
              },
              ...(dte.reception
                ? [
                    {
                      key: 'Recepción',
                      value: `${formatQuantity(dte.reception.receivedQuantity, dte.reception.unit)} · ${formatDateTime(dte.reception.receivedAt)}`,
                    },
                  ]
                : []),
            ]}
          />
        </Card>

        <Card title="Transporte">
          <SummaryList
            rows={[
              {
                key: 'Vehículo',
                value: TRANSPORT_TYPES.label(dte.transportType),
              },
              {
                key: 'Patente',
                value: <span className="mono">{dte.transportPlate ?? '—'}</span>,
              },
              {
                key: 'Acoplado',
                value: <span className="mono">{dte.transportTrailerPlate ?? '—'}</span>,
              },
              { key: 'Conductor', value: dte.movement.driverName ?? '—' },
              { key: 'Precintos', value: 'No corresponden (API-SEM)' },
            ]}
          />
        </Card>

        <Card title="Historial del DT-e">
          {dte.history.length > 0 ? (
            <ul className="timeline">
              {dte.history.map((entry) => (
                <li key={entry.id}>
                  <div className="timeline-what">
                    {entry.fromStatus && entry.fromStatus !== entry.toStatus
                      ? `${statusInfo(entry.fromStatus).label} → ${statusInfo(entry.toStatus).label}`
                      : statusInfo(entry.toStatus).label}
                  </div>
                  <div className="timeline-when">
                    {formatDateTime(entry.occurredAt)} ·{' '}
                    {HISTORY_SOURCES[entry.source] ?? entry.source}
                  </div>
                  {entry.reason && <div className="small muted">{entry.reason}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Sin cambios registrados.</p>
          )}
        </Card>
      </div>

      {dte.related.length > 0 && (
        <Card title="Otros DT-e de este traslado">
          <ul className="plain-list">
            {dte.related.map((other) => (
              <li key={other.id} className="row">
                <Link to={`/dte/${other.id}`} className="mono">
                  {other.number ?? 'Sin número'}
                </Link>
                <StatusPill status={other.status} />
                {other.voidReason && <span className="small muted">{other.voidReason}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ---------------------------------------------- constancia imprimible */}
      <section className="print-only dte-print">
        <h1>Constancia de DT-e · ApiTrace</h1>
        {dte.issueMode !== 'SIGSA' && (
          <p>
            <strong>
              Esta constancia no reemplaza al DT-e oficial emitido por SENASA
              {dte.issueMode === 'SIMULADO' ? ' (emisión SIMULADA, sin validez oficial)' : ''}.
            </strong>
          </p>
        )}
        <table>
          <tbody>
            <tr>
              <th>Número</th>
              <td>{dte.number ?? '—'}</td>
            </tr>
            <tr>
              <th>Estado</th>
              <td>{statusInfo(dte.status).label}</td>
            </tr>
            <tr>
              <th>Movimiento</th>
              <td>
                {dte.movementTypeCode} · {dte.transitReason}
              </td>
            </tr>
            <tr>
              <th>Origen (RENAPA)</th>
              <td>{dte.originCode ?? '—'}</td>
            </tr>
            <tr>
              <th>Destino (sala)</th>
              <td>
                {dte.destinationCode ?? '—'} · {dte.destination.name}
              </td>
            </tr>
            <tr>
              <th>Titular</th>
              <td>
                {dte.holder?.businessName ?? '—'}{' '}
                {dte.holderTaxId ? `· CUIT ${dte.holderTaxId}` : ''}
              </td>
            </tr>
            <tr>
              <th>Producto</th>
              <td>
                {dte.productCode} — {dte.productName}
              </td>
            </tr>
            <tr>
              <th>Alzas declaradas</th>
              <td>{dte.declaredQuantity ?? '—'}</td>
            </tr>
            <tr>
              <th>Carga / vencimiento</th>
              <td>
                {formatDay(dte.loadDate)} / {formatDay(dte.expiryDate)}
              </td>
            </tr>
            <tr>
              <th>Transporte</th>
              <td>
                {TRANSPORT_TYPES.label(dte.transportType)} {dte.transportPlate ?? ''}{' '}
                {dte.transportTrailerPlate ? `+ ${dte.transportTrailerPlate}` : ''}
              </td>
            </tr>
            {isIssuerView && (
              <tr>
                <th>Código de cierre</th>
                <td>{dte.verificationCode}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {confirmRequest && (
        <ConfirmDialog
          title="Pedir el DT-e a SIGSA"
          tone="primary"
          description={
            <>
              Se envía la solicitud con {dte.declaredQuantity} alzas declaradas, carga el{' '}
              {formatDay(dte.loadDate)} y vencimiento el {formatDay(dte.expiryDate)}. El número y el
              código de cierre llegan en unos segundos.
              {dte.integration.mode === 'simulado' && (
                <>
                  {' '}
                  <strong>Modo simulado: el número no tendrá validez oficial.</strong>
                </>
              )}
            </>
          }
          confirmLabel="Enviar a SIGSA"
          busy={requesting}
          onCancel={() => setConfirmRequest(false)}
          onConfirm={() => void requestEmission()}
        />
      )}

      {action && (
        <ActionSheet
          spec={action}
          subtitle={dte.number ?? dte.movement.code}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            resource.reload();
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   Formulario de accion
   ========================================================================= */

const ActionSheet = ({
  spec,
  subtitle,
  onClose,
  onDone,
}: {
  spec: ActionSpec;
  subtitle: string;
  onClose: () => void;
  onDone: () => void;
}) => {
  const { values, set, blur, errors, setErrors, validateAll } = useForm(spec.fields);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{
    title: string;
    detail?: string;
  } | null>(null);
  const feedback = useWriteFeedback();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateAll()) return;
    setBusy(true);
    setFailure(null);
    try {
      const result = await apiSend(spec.method, spec.path, spec.toBody(values), {
        label: `${spec.title} — ${subtitle}`,
        entity: '/dte',
      });
      if (result.queued) feedback.queued('La operación');
      else feedback.saved(`${spec.label}: listo`, subtitle);
      onDone();
    } catch (cause) {
      const perField = fieldErrors(
        cause,
        spec.fields.map((field) => field.name),
      );
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
    <Sheet title={spec.title} subtitle={subtitle} onClose={onClose}>
      {spec.notice && <Notice tone="info">{spec.notice}</Notice>}
      <Form
        onSubmit={submit}
        error={failure && <FormError title={failure.title} detail={failure.detail} />}
        submitLabel={spec.submit}
        busyLabel="Enviando…"
        onCancel={onClose}
        busy={busy}
        cancelLabel="Volver"
      >
        <Fields fields={spec.fields} values={values} errors={errors} onChange={set} onBlur={blur} />
      </Form>
    </Sheet>
  );
};
