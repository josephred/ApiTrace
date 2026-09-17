import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiSend } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { formatDateTime, formatQuantity, toLocalInput } from '../lib/format';
import {
  DEFAULT_MATERIAL,
  ESTABLISHMENT_TYPES,
  MATERIAL_TYPES,
  MOVEMENT_TYPES,
  UNITS,
  statusInfo,
} from '../lib/vocabulary';
import {
  Button,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  Pill,
  Sheet,
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
  buildBody,
  useForm,
  type FieldSpec,
} from '../components/Form';
import type { Apiary, Establishment, Movement, Paginated } from '../lib/types';

const STATUS_FILTERS = [
  'DRAFT',
  'DISPATCHED',
  'IN_TRANSIT',
  'RECEIVED',
  'PARTIALLY_RECEIVED',
  'REJECTED',
  'CANCELLED',
];

/* =========================================================================
   Listado
   ========================================================================= */

export const MovementsPage = () => {
  const { canWrite } = useAuth();
  const [params, setParams] = useSearchParams();
  const [pageSize, setPageSize] = useState(25);
  const [creating, setCreating] = useState(false);

  // El panel enlaza acá con un estado ya elegido («traslados que esperan
  // recepción»); leerlo de la URL mantiene coherente de dónde vino el usuario.
  const status = params.get('status') ?? '';

  const list = useResource<Paginated<Movement>>(
    `/movements?pageSize=${pageSize}${status ? `&status=${status}` : ''}`,
  );
  const establishments = useResource<Paginated<Establishment>>('/establishments?pageSize=100');
  const apiaries = useResource<Paginated<Apiary>>('/apiaries?pageSize=100');

  const setStatus = (next: string) => {
    if (next) setParams({ status: next });
    else setParams({});
  };

  const columns: Column<Movement>[] = [
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
    { key: 'material', header: 'Material', cell: (item) => MATERIAL_TYPES.label(item.materialType) },
    {
      key: 'quantity',
      header: 'Cantidad',
      align: 'right',
      cell: (item) => formatQuantity(item.quantity, item.unit),
    },
    {
      key: 'scheduled',
      header: 'Traslado',
      cell: (item) => <span className="nowrap">{formatDateTime(item.scheduledAt)}</span>,
    },
    {
      key: 'document',
      header: 'Documento',
      cell: (item) =>
        item.requiresDocument ? (
          <Pill tone="warning" icon="document">
            Exige {item.requiredDocumentType}
          </Pill>
        ) : (
          <span className="faint small">No exige</span>
        ),
    },
  ];

  return (
    <div className="stack">
      <PageHeader
        title="Movimientos"
        help="movements"
        actions={
          canWrite && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Nuevo movimiento
            </Button>
          )
        }
      />

      <ResourceNotices resource={list} />

      <div className="filters">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {STATUS_FILTERS.map((option) => (
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
          rowHref={(item) => `/movements/${item.id}`}
          loading={list.loading}
          total={list.data?.meta.total}
          onLoadMore={() => setPageSize((size) => size + 25)}
          loadingMore={list.loading}
          empty={
            <EmptyState
              icon="movements"
              title={status ? 'No hay movimientos en ese estado' : 'Todavía no hay movimientos'}
              description={
                status
                  ? 'Probá con otro estado o quita el filtro.'
                  : 'Un traslado del apiario a la sala de extracción es lo que arranca la cadena.'
              }
              action={
                status ? (
                  <Button onClick={() => setStatus('')} icon="close">
                    Ver todos
                  </Button>
                ) : (
                  canWrite && (
                    <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                      Registrar movimiento
                    </Button>
                  )
                )
              }
            />
          }
        />
      </Card>

      {creating && (
        <NewMovementWizard
          establishments={establishments.data?.data ?? []}
          apiaries={apiaries.data?.data ?? []}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            list.reload();
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   Asistente de alta
   ========================================================================= */

const STEP_NAMES = ['Qué se traslada', 'Origen y destino', 'Confirmar'];

/**
 * Doce campos en un solo formulario eran, en un teléfono, una pantalla de
 * desplazamiento continuo donde nadie sabia cuanto faltaba. Repartirlos en tres
 * etapas no quita ningún campo: los agrupa por la pregunta que responden y
 * permite validar cada tramo antes de seguir.
 */
const NewMovementWizard = ({
  establishments,
  apiaries,
  onClose,
  onDone,
}: {
  establishments: Establishment[];
  apiaries: Apiary[];
  onClose: () => void;
  onDone: () => void;
}) => {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const feedback = useWriteFeedback();

  const establishmentOptions = establishments.map((item) => ({
    value: item.id,
    label: `${item.name} · ${ESTABLISHMENT_TYPES.label(item.type)}`,
  }));

  const fields: FieldSpec[] = useMemo(
    () => [
      // ---------------------------------------------------------- paso 1
      {
        name: 'movementType',
        label: 'Qué se traslada',
        type: 'select',
        required: true,
        full: true,
        defaultValue: 'MATERIAL_MELARIO',
        options: MOVEMENT_TYPES.options,
      },
      {
        name: 'quantity',
        label: 'Cantidad',
        type: 'number',
        step: '0.001',
        min: '0',
        required: true,
        inputMode: 'decimal',
      },
      {
        name: 'unit',
        label: 'Unidad',
        type: 'select',
        required: true,
        defaultValue: 'KG',
        options: UNITS.options,
      },
      {
        name: 'materialType',
        label: 'Material',
        type: 'select',
        required: true,
        full: true,
        defaultValue: 'MATERIAL_MELARIO',
        options: MATERIAL_TYPES.options,
        hint: 'Se completa solo según lo que trasladas. Cambialo si no corresponde.',
      },
      // ---------------------------------------------------------- paso 2
      {
        name: 'originEstablishmentId',
        label: 'Sale de',
        type: 'select',
        required: true,
        full: true,
        options: establishmentOptions,
      },
      {
        name: 'originApiaryId',
        label: 'Apiario de origen',
        type: 'select',
        full: true,
        options: apiaries.map((item) => ({
          value: item.id,
          label: item.name ? `${item.code} — ${item.name}` : item.code,
        })),
        help: 'originApiary',
        hint: 'Es lo único que permite saber después de qué apiario salió.',
      },
      {
        name: 'destinationEstablishmentId',
        label: 'Llega a',
        type: 'select',
        required: true,
        full: true,
        options: establishmentOptions,
        validate: (value, all) =>
          value && value === all.originEstablishmentId
            ? 'El destino tiene que ser distinto del origen.'
            : null,
      },
      {
        name: 'scheduledAt',
        label: 'Fecha del traslado',
        type: 'datetime-local',
        required: true,
        full: true,
        defaultValue: toLocalInput(),
        help: 'scheduledAt',
      },
      // ---------------------------------------------------------- paso 3
      { name: 'driverName', label: 'Conductor' },
      { name: 'driverDocument', label: 'Documento del conductor', inputMode: 'numeric' },
      { name: 'notes', label: 'Observaciones', type: 'textarea', full: true },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [establishments.length, apiaries.length],
  );

  const { values, set, setValues, blur, errors, setErrors, validateAll } = useForm(fields);

  const stepFields: string[][] = [
    ['movementType', 'quantity', 'unit', 'materialType'],
    ['originEstablishmentId', 'originApiaryId', 'destinationEstablishmentId', 'scheduledAt'],
    ['driverName', 'driverDocument', 'notes'],
  ];

  const byName = (name: string) => fields.find((field) => field.name === name)!;
  const pick = (names: string[]) => names.map(byName);

  /** Elegir que se traslada completa el material: dos preguntas casi iguales
   *  eran una fuente segura de confusion. */
  const onMovementType = (value: string) => {
    setValues((current) => ({
      ...current,
      movementType: value,
      materialType: DEFAULT_MATERIAL[value] ?? current.materialType,
    }));
  };

  const next = () => {
    if (!validateAll(stepFields[step])) return;
    setStep((current) => current + 1);
  };

  const back = () => {
    if (step === 0) onClose();
    else setStep((current) => current - 1);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateAll()) return;

    setBusy(true);
    setFailure(null);
    try {
      const result = await apiSend<Movement>('POST', '/movements', buildBody(values, fields), {
        label: `Movimiento de ${MATERIAL_TYPES.label(values.materialType)} (${values.quantity} ${values.unit})`,
        entity: '/movements',
      });

      if (result.queued) {
        feedback.queued('El movimiento');
        onDone();
        return;
      }

      const rule = result.data.appliedRule;
      feedback.saved(
        `Movimiento ${result.data.code} creado`,
        rule?.requiresDocument
          ? `Necesita ${rule.requiredDocumentType} antes de despachar.`
          : undefined,
      );
      onDone();
    } catch (cause) {
      const perField = fieldErrors(cause, fields.map((field) => field.name));
      if (Object.keys(perField).length > 0) {
        setErrors((current) => ({ ...current, ...perField }));
        // Volver al paso donde esta el problema, en lugar de dejar el error
        // en una etapa que ya no se ve.
        const firstBad = Object.keys(perField)[0];
        const target = stepFields.findIndex((group) => group.includes(firstBad));
        if (target >= 0) setStep(target);
      } else {
        const message = toUserMessage(cause, 'write');
        setFailure({ title: message.title, detail: message.detail });
      }
    } finally {
      setBusy(false);
    }
  };

  const label = (name: string, source: { value: string; label: string }[]) =>
    source.find((option) => option.value === values[name])?.label ?? '—';

  return (
    <Sheet title="Nuevo movimiento" onClose={onClose}>
      <Steps names={STEP_NAMES} current={step} />

      <form onSubmit={submit} noValidate>
        {failure && <FormError title={failure.title} detail={failure.detail} />}

        {/* ------------------------------------------------------ paso 1 */}
        {step === 0 && (
          <>
            <Field
              spec={byName('movementType')}
              value={values.movementType ?? ''}
              error={errors.movementType}
              onChange={onMovementType}
            />
            <div className="form-grid">
              <Field
                spec={byName('quantity')}
                value={values.quantity ?? ''}
                error={errors.quantity}
                onChange={(value) => set('quantity', value)}
                onBlur={() => blur('quantity')}
              />
              <Field
                spec={byName('unit')}
                value={values.unit ?? ''}
                error={errors.unit}
                onChange={(value) => set('unit', value)}
              />
            </div>
            <Disclosure label={`Material: ${MATERIAL_TYPES.label(values.materialType)} — cambiar`}>
              <Field
                spec={byName('materialType')}
                value={values.materialType ?? ''}
                error={errors.materialType}
                onChange={(value) => set('materialType', value)}
              />
            </Disclosure>
            <WizardActions onBack={back} onNext={next} nextLabel="Continuar" />
          </>
        )}

        {/* ------------------------------------------------------ paso 2 */}
        {step === 1 && (
          <>
            <Fields
              fields={pick(stepFields[1])}
              values={values}
              errors={errors}
              onChange={set}
              onBlur={blur}
            />
            <Notice tone="info" title="La fecha decide si hace falta documento">
              El sistema mira que norma regía el día del traslado, no el día en que lo cargas.
            </Notice>
            <WizardActions onBack={back} onNext={next} nextLabel="Continuar" />
          </>
        )}

        {/* ------------------------------------------------------ paso 3 */}
        {step === 2 && (
          <>
            <div className="form-section-title">Revisá antes de crear</div>
            <SummaryList
              rows={[
                { key: 'Traslado', value: MOVEMENT_TYPES.label(values.movementType) },
                { key: 'Material', value: MATERIAL_TYPES.label(values.materialType) },
                {
                  key: 'Cantidad',
                  value: formatQuantity(values.quantity, values.unit),
                },
                { key: 'Sale de', value: label('originEstablishmentId', establishmentOptions) },
                ...(values.originApiaryId
                  ? [
                      {
                        key: 'Apiario',
                        value:
                          apiaries.find((item) => item.id === values.originApiaryId)?.code ?? '—',
                      },
                    ]
                  : []),
                { key: 'Llega a', value: label('destinationEstablishmentId', establishmentOptions) },
                {
                  key: 'Fecha',
                  value: values.scheduledAt ? formatDateTime(values.scheduledAt) : '—',
                },
              ]}
            />

            <Disclosure label="Transporte y observaciones (opcional)">
              {pick(stepFields[2]).map((spec) => (
                <Field
                  key={spec.name}
                  spec={spec}
                  value={values[spec.name] ?? ''}
                  error={errors[spec.name]}
                  onChange={(value) => set(spec.name, value)}
                />
              ))}
            </Disclosure>

            <WizardActions
              onBack={back}
              nextLabel="Crear movimiento"
              submit
              busy={busy}
              busyLabel="Creando…"
            />
          </>
        )}
      </form>
    </Sheet>
  );
};
