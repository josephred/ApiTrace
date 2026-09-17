import { useState, type FormEvent } from 'react';
import { apiSend } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { formatDate, formatQuantity, toLocalInput } from '../lib/format';
import { LOT_TYPES, statusInfo } from '../lib/vocabulary';
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  Sheet,
  StatusPill,
  useWriteFeedback,
} from '../components/ui';
import { DataList, type Column } from '../components/DataList';
import { ResourceNotices } from '../components/ResourceNotices';
import {
  ChoiceGroup,
  Disclosure,
  Field,
  Fields,
  Form,
  FormError,
  buildBody,
  useForm,
  type FieldSpec,
} from '../components/Form';
import type { Establishment, Extraction, Lot, Paginated } from '../lib/types';

const LOT_STATUSES = ['OPEN', 'CLOSED', 'BLOCKED', 'DISPATCHED', 'CONSUMED'];

/* =========================================================================
   Listado
   ========================================================================= */

export const LotsPage = () => {
  const { canWrite } = useAuth();
  const [status, setStatus] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [creating, setCreating] = useState(false);

  const list = useResource<Paginated<Lot>>(
    `/lots?pageSize=${pageSize}${status ? `&status=${status}` : ''}`,
  );
  const establishments = useResource<Paginated<Establishment>>('/establishments?pageSize=100');
  const extractions = useResource<Paginated<Extraction>>('/extractions?pageSize=100');
  const sourceLots = useResource<Paginated<Lot>>('/lots?pageSize=100&status=OPEN');

  const columns: Column<Lot>[] = [
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
    { key: 'type', header: 'Tipo', cell: (item) => LOT_TYPES.label(item.lotType) },
    {
      key: 'production',
      header: 'Producción',
      cell: (item) => <span className="nowrap">{formatDate(item.productionDate)}</span>,
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      align: 'right',
      cell: (item) => formatQuantity(item.quantity, item.unit),
    },
    {
      key: 'available',
      header: 'Disponible',
      align: 'right',
      cell: (item) => formatQuantity(item.availableQuantity, item.unit),
    },
  ];

  return (
    <div className="stack">
      <PageHeader
        title="Lotes"
        help="lots"
        actions={
          canWrite && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Nuevo lote
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
          {LOT_STATUSES.map((option) => (
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
          rowHref={(item) => `/lots/${item.id}`}
          loading={list.loading}
          total={list.data?.meta.total}
          onLoadMore={() => setPageSize((size) => size + 25)}
          loadingMore={list.loading}
          rowActions={(item) => (
            <ButtonLink size="sm" to={`/trace/backward/lot/${item.id}`} icon="trace">
              De dónde vino
            </ButtonLink>
          )}
          empty={
            <EmptyState
              icon="lots"
              title={status ? 'No hay lotes en ese estado' : 'Todavía no hay lotes'}
              description={
                status
                  ? 'Probá con otro estado o quita el filtro.'
                  : 'Un lote nace de una extracción o del acopio de otros lotes.'
              }
              action={
                status ? (
                  <Button onClick={() => setStatus('')} icon="close">
                    Ver todos
                  </Button>
                ) : (
                  canWrite && (
                    <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                      Crear lote
                    </Button>
                  )
                )
              }
            />
          }
        />
      </Card>

      {creating && (
        <CreateLotSheet
          establishments={establishments.data?.data ?? []}
          extractions={(extractions.data?.data ?? []).filter((item) => item.status === 'COMPLETED')}
          sourceLots={sourceLots.data?.data ?? []}
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
   Alta de lote
   ========================================================================= */

type OriginKind = 'extraction' | 'lot' | 'none';

const CreateLotSheet = ({
  establishments,
  extractions,
  sourceLots,
  onClose,
  onDone,
}: {
  establishments: Establishment[];
  extractions: Extraction[];
  sourceLots: Lot[];
  onClose: () => void;
  onDone: () => void;
}) => {
  const core: FieldSpec[] = [
    {
      name: 'establishmentId',
      label: 'Establecimiento',
      type: 'select',
      required: true,
      full: true,
      defaultValue: establishments.length === 1 ? establishments[0].id : '',
      options: establishments.map((item) => ({ value: item.id, label: item.name })),
    },
    {
      name: 'lotType',
      label: 'Tipo de lote',
      type: 'select',
      required: true,
      defaultValue: 'EXTRACCION',
      options: LOT_TYPES.options,
    },
    {
      name: 'productionDate',
      label: 'Fecha de producción',
      type: 'datetime-local',
      required: true,
      defaultValue: toLocalInput(),
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
      options: ['KG', 'LITRO', 'TAMBOR'].map((unit) => ({ value: unit, label: unit })),
    },
  ];

  const quality: FieldSpec[] = [
    { name: 'honeyType', label: 'Tipo de miel', placeholder: 'Multifloral' },
    {
      name: 'moisturePercent',
      label: 'Humedad (%)',
      type: 'number',
      step: '0.01',
      min: '0',
      max: '100',
      inputMode: 'decimal',
    },
    { name: 'color', label: 'Color', placeholder: 'Ámbar claro' },
  ];

  const all = [...core, ...quality];
  const { values, set, blur, errors, setErrors, validateAll } = useForm(all);

  /**
   * El origen era antes dos selects que el código excluia entre si pero que en
   * pantalla parecian independientes. Como eleccion explicita se ve que son
   * alternativas, y la tercera opcion obliga a asumir que se corta la cadena.
   */
  const [origin, setOrigin] = useState<OriginKind>(
    extractions.length > 0 ? 'extraction' : sourceLots.length > 0 ? 'lot' : 'none',
  );
  const [extractionId, setExtractionId] = useState('');
  const [sourceLotId, setSourceLotId] = useState('');
  const [sourceQuantity, setSourceQuantity] = useState('');
  const [originError, setOriginError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const feedback = useWriteFeedback();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setOriginError(null);

    if (origin === 'extraction' && !extractionId) {
      setOriginError('Elegí de qué extracción viene este lote.');
      return;
    }
    if (origin === 'lot' && !sourceLotId) {
      setOriginError('Elegí de qué lote viene.');
      return;
    }
    if (!validateAll()) return;

    setBusy(true);
    setFailure(null);
    try {
      const body = buildBody(values, all);
      if (origin === 'extraction' && extractionId) body.extractionId = extractionId;
      if (origin === 'lot' && sourceLotId) {
        body.inputs = [
          {
            sourceType: 'LOT',
            sourceLotId,
            quantity: Number(sourceQuantity || values.quantity),
            unit: values.unit || 'KG',
          },
        ];
      }

      const result = await apiSend<Lot>('POST', '/lots', body, {
        label: `Lote de ${values.quantity} ${values.unit}`,
        entity: '/lots',
      });
      if (result.queued) feedback.queued('El lote');
      else feedback.saved('Lote creado', result.data.code);
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
    <Sheet title="Nuevo lote" subtitle="Los campos con * son obligatorios." onClose={onClose}>
      <Form
        onSubmit={submit}
        error={failure && <FormError title={failure.title} detail={failure.detail} />}
        submitLabel="Crear lote"
        busyLabel="Creando…"
        onCancel={onClose}
        busy={busy}
      >
        <Fields fields={core} values={values} errors={errors} onChange={set} onBlur={blur} />

        <div className="form-section">
          <div className="form-section-title">De dónde viene</div>
          <ChoiceGroup
            help="lotOrigin"
            value={origin}
            onChange={(value) => {
              setOrigin(value as OriginKind);
              setOriginError(null);
            }}
            options={[
              {
                value: 'extraction',
                title: 'De una extracción',
                description: 'La miel salió de un proceso en la sala.',
              },
              {
                value: 'lot',
                title: 'De otro lote',
                description: 'Acopio o mezcla: se consume parte de un lote existente.',
              },
              {
                value: 'none',
                title: 'Sin origen declarado',
                description: 'La trazabilidad hacia atrás va a quedar incompleta.',
              },
            ]}
          />

          {origin === 'extraction' && (
            <div className="field">
              <label className="field-label" htmlFor="extractionId">
                Extracción
                <span aria-hidden="true" style={{ color: 'var(--danger-fg)' }}>
                  *
                </span>
              </label>
              <select
                id="extractionId"
                value={extractionId}
                onChange={(event) => setExtractionId(event.target.value)}
              >
                <option value="">Elegí una extracción</option>
                {extractions.map((extraction) => (
                  <option key={extraction.id} value={extraction.id}>
                    {extraction.code} — {formatQuantity(extraction.outputQuantity, extraction.unit)}
                  </option>
                ))}
              </select>
              {extractions.length === 0 && (
                <span className="field-hint">
                  No hay extracciones terminadas todavía. Elegí otro origen.
                </span>
              )}
            </div>
          )}

          {origin === 'lot' && (
            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="sourceLotId">
                  Lote de origen
                  <span aria-hidden="true" style={{ color: 'var(--danger-fg)' }}>
                    *
                  </span>
                </label>
                <select
                  id="sourceLotId"
                  value={sourceLotId}
                  onChange={(event) => setSourceLotId(event.target.value)}
                >
                  <option value="">Elegí un lote</option>
                  {sourceLots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.code} — quedan {formatQuantity(lot.availableQuantity, lot.unit)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="sourceQuantity">
                  Cantidad a consumir
                  <span className="field-optional">opcional</span>
                </label>
                <input
                  id="sourceQuantity"
                  type="number"
                  step="0.001"
                  min="0"
                  inputMode="decimal"
                  value={sourceQuantity}
                  onChange={(event) => setSourceQuantity(event.target.value)}
                  placeholder={values.quantity || '0'}
                />
                <span className="field-hint">
                  Si lo dejas vacío, se consume la cantidad del lote nuevo.
                </span>
              </div>
            </div>
          )}

          {origin === 'none' && (
            <Notice tone="warning" title="Este lote va a quedar sin origen">
              Al consultar de dónde vino, el sistema no va a poder responder y lo va a marcar como
              hueco de trazabilidad.
            </Notice>
          )}

          {originError && <FormError title={originError} />}
        </div>

        <Disclosure label="Datos de calidad (opcional)">
          {quality.map((spec) => (
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
