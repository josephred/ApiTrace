import { useState, useMemo, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { apiSend } from '../lib/api';
import { toUserMessage } from '../lib/errors';
import {
  addDaysIso,
  DEFAULT_VALIDITY_DAYS,
  formatDay,
  isValidPlate,
  normalizePlate,
  suggestDeclaredQuantity,
  todayAr,
} from '../lib/dte';
import { DTE_STATUSES } from '../lib/vocabulary';
import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Sheet,
  Stat,
  StatusPill,
  useWriteFeedback,
} from '../components/ui';
import { DataList, type Column } from '../components/DataList';
import { TransitSemaphoreBadge } from '../components/TransitSemaphoreBadge';
import { DteChecks } from '../components/DteChecks';
import type { Dte, Movement, Paginated, DtePreflightResult } from '../lib/types';

interface DteSummary {
  borradores: number;
  solicitados: number;
  emitidos: number;
  vigentes: number;
  vencidos: number;
  caducados: number;
  cerrados: number;
  total: number;
}

export const DtePage = () => {
  const { canWrite } = useAuth();
  const [params, setParams] = useSearchParams();

  const perspective = (params.get('perspective') as 'EMITIDOS' | 'RECIBIDOS') || 'EMITIDOS';
  const status = params.get('status') || '';
  const [pageSize, setPageSize] = useState(25);
  const [isCreating, setIsCreating] = useState(false);

  const queryUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set('pageSize', String(pageSize));
    if (perspective) q.set('perspective', perspective);
    if (status) q.set('status', status);
    return `/dte?${q.toString()}`;
  }, [pageSize, perspective, status]);

  const list = useResource<Paginated<Dte>>(queryUrl);
  const summaryRes = useResource<DteSummary>('/dte/summary');

  const setPerspective = (p: 'EMITIDOS' | 'RECIBIDOS') => {
    params.set('perspective', p);
    setParams(params);
  };

  const setStatus = (s: string) => {
    if (s) params.set('status', s);
    else params.delete('status');
    setParams(params);
  };

  const columns: Column<Dte>[] = [
    {
      key: 'number',
      header: 'Número Oficial',
      role: 'title',
      cell: (item) => (
        <div className="stack" style={{ gap: 2 }}>
          <strong className="mono">{item.number ?? 'S/N (Borrador)'}</strong>
          {item.issueMode && (
            <span className="small muted">
              {item.issueMode === 'SIGSA' ? 'SENASA / SIGSA' : item.issueMode === 'MANUAL' ? 'Carga manual' : 'Simulado'}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'transit',
      header: 'Semáforo Tránsito',
      role: 'status',
      cell: (item) => (
        <TransitSemaphoreBadge
          semaphore={item.transitSemaphore}
          reason={item.transitReasonText}
          size="sm"
        />
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (item) => <StatusPill status={item.status} />,
    },
    {
      key: 'renspa',
      header: 'Origen → Destino',
      cell: (item) => (
        <div className="stack small" style={{ gap: 2 }}>
          <span>
            <strong className="muted">De:</strong> {item.originRenspa ?? '—'}
          </span>
          <span>
            <strong className="muted">A:</strong> {item.destinationRenspa ?? '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Carga y Vencimiento',
      cell: (item) => (
        <div className="stack small" style={{ gap: 2 }}>
          <span>Carga: {formatDay(item.loadDate)}</span>
          <span className={item.status === 'VENCIDO' ? 'font-medium' : 'muted'} style={{ color: item.status === 'VENCIDO' ? 'var(--danger)' : undefined }}>
            Vence: {formatDay(item.expiryDate)}
          </span>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Cant. Declarada',
      align: 'right',
      cell: (item) => (
        <span className="nowrap font-medium">
          {item.declaredQuantity ?? 0} {item.unit ?? 'ALZA'}
        </span>
      ),
    },
  ];

  const summary = summaryRes.data;

  return (
    <div className="stack">
      <PageHeader
        title="Documentos de Tránsito Electrónicos (DT-e)"
        sub="Gestión oficial del traslado apícola ante SENASA / ARCA según normativa vigente."
        help="dte"
        actions={
          canWrite && (
            <Button variant="primary" icon="plus" onClick={() => setIsCreating(true)}>
              Nuevo DT-e
            </Button>
          )
        }
      />

      {summary && (
        <div className="grid-stats">
          <Stat
            label="Total DT-e"
            value={summary.total}
            hint="En el sistema"
          />
          <Stat
            label="En tránsito"
            value={<span style={{ color: '#16a34a' }}>{summary.vigentes}</span>}
            hint="Amparados por DT-e"
          />
          <Stat
            label="Vencidos / Caducados"
            value={<span style={{ color: '#dc2626' }}>{summary.vencidos + summary.caducados}</span>}
            hint="Requieren regularización"
          />
          <Stat
            label="Cerrados en sala"
            value={<span style={{ color: '#2563eb' }}>{summary.cerrados}</span>}
            hint="Recepción completa"
          />
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
        <div className="row row-tight">
          <Button
            size="sm"
            variant={perspective === 'EMITIDOS' ? 'primary' : 'secondary'}
            onClick={() => setPerspective('EMITIDOS')}
          >
            Emitidos por mi organización
          </Button>
          <Button
            size="sm"
            variant={perspective === 'RECIBIDOS' ? 'primary' : 'secondary'}
            onClick={() => setPerspective('RECIBIDOS')}
          >
            Destinados a mi organización
          </Button>
        </div>

        <div className="row row-tight">
          <label htmlFor="filter-status" className="small muted">
            Filtrar:
          </label>
          <select
            id="filter-status"
            className="field-input"
            style={{ width: 'auto', minWidth: '180px' }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {DTE_STATUSES.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {status && (
            <Button size="sm" icon="close" onClick={() => setStatus('')}>
              Quitar filtro
            </Button>
          )}
        </div>
      </div>

      <Card flush>
        <DataList
          items={list.data?.data ?? []}
          columns={columns}
          rowKey={(item) => item.id}
          rowHref={(item) => `/dte/${item.id}`}
          loading={list.loading}
          total={list.data?.meta.total}
          onLoadMore={() => setPageSize((s) => s + 25)}
          loadingMore={list.loading}
          empty={
            <EmptyState
              icon="document"
              title={status ? 'No hay DT-e en ese estado' : 'No se encontraron documentos'}
              description={
                status
                  ? 'Probá ajustando el filtro de estado o la perspectiva.'
                  : 'Los DT-e amparan el traslado sanitario desde el apiario hacia la sala de extracción o acopio.'
              }
              action={
                status ? (
                  <Button onClick={() => setStatus('')} icon="close">
                    Ver todos
                  </Button>
                ) : (
                  canWrite && (
                    <Button variant="primary" icon="plus" onClick={() => setIsCreating(true)}>
                      Preparar DT-e
                    </Button>
                  )
                )
              }
            />
          }
        />
      </Card>

      {isCreating && (
        <CreateDteWizard
          onClose={() => setIsCreating(false)}
          onDone={() => {
            setIsCreating(false);
            list.reload();
            summaryRes.reload();
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   Asistente de Preparación y Solicitud de DT-e
   ========================================================================= */

const CreateDteWizard = ({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) => {
  const feedback = useWriteFeedback();
  const [movementId, setMovementId] = useState('');
  const [loadDate, setLoadDate] = useState(todayAr());
  const [expiryDate, setExpiryDate] = useState(addDaysIso(todayAr(), DEFAULT_VALIDITY_DAYS));
  const [transportType, setTransportType] = useState('PROPIO');
  const [transportPlate, setTransportPlate] = useState('');
  const [transportTrailerPlate, setTransportTrailerPlate] = useState('');
  const [declaredQuantity, setDeclaredQuantity] = useState<number | string>('');

  const [preflight, setPreflight] = useState<DtePreflightResult | null>(null);
  const [checkingPreflight, setCheckingPreflight] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  // Cargar movimientos que requieran DT-e
  const movementsRes = useResource<Paginated<Movement>>('/movements?pageSize=50');
  const eligibleMovements = useMemo(() => {
    return (movementsRes.data?.data ?? []).filter(
      (m) => m.requiresDocument && ['DRAFT', 'DISPATCHED'].includes(m.status),
    );
  }, [movementsRes.data]);

  const handleSelectMovement = async (id: string) => {
    setMovementId(id);
    if (!id) {
      setPreflight(null);
      return;
    }

    const selectedMov = eligibleMovements.find((m) => m.id === id);
    if (selectedMov) {
      const estQty = Number(selectedMov.quantity) || 0;
      setDeclaredQuantity(suggestDeclaredQuantity(estQty));
    }

    setCheckingPreflight(true);
    setError(null);
    try {
      const res = await apiSend<DtePreflightResult>(
        'POST',
        '/dte/preflight',
        { movementId: id },
        { label: 'Evaluación previa DT-e', entity: '/dte', queueOffline: false },
      );
      if (!res.queued) {
        setPreflight(res.data);
        if (res.data.defaultDates) {
          setLoadDate(res.data.defaultDates.loadDate);
          setExpiryDate(res.data.defaultDates.expiryDate);
        }
        if (res.data.suggestedDeclaredQuantity) {
          setDeclaredQuantity(res.data.suggestedDeclaredQuantity);
        }
      }
    } catch (err) {
      setError(err);
    } finally {
      setCheckingPreflight(false);
    }
  };

  const handlePlateChange = (val: string) => {
    setTransportPlate(normalizePlate(val));
  };

  const handleTrailerPlateChange = (val: string) => {
    setTransportTrailerPlate(normalizePlate(val));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!movementId) return;

    if (transportPlate && !isValidPlate(transportPlate)) {
      setError(new Error('La patente del vehículo no tiene un formato válido (ej. AB123CD o ABC123).'));
      return;
    }

    if (transportTrailerPlate && !isValidPlate(transportTrailerPlate)) {
      setError(new Error('La patente del acoplado no tiene un formato válido.'));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await apiSend(
        'POST',
        '/dte/draft',
        {
          movementId,
          loadDate,
          expiryDate,
          declaredQuantity: Number(declaredQuantity) || undefined,
          transportType,
          transportPlate: transportPlate || undefined,
          transportTrailerPlate: transportTrailerPlate || undefined,
        },
        {
          label: 'Creación de borrador DT-e',
          entity: '/dte',
        },
      );

      if (res.queued) {
        feedback.queued('El borrador de DT-e');
      } else {
        feedback.saved('DT-e creado en borrador', 'Podés solicitarlo a SENASA o cargarlo manualmente.');
      }
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Preparar DT-e oficial"
      subtitle="Generá el borrador oficial con validaciones preflight automáticas de SENASA."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="stack">
        {error ? <ErrorNotice message={toUserMessage(error, 'write')} /> : null}

        <div className="field">
          <label className="field-label" htmlFor="dte-movement">
            Movimiento a amparar *
          </label>
          <select
            id="dte-movement"
            className="field-input"
            value={movementId}
            onChange={(e) => handleSelectMovement(e.target.value)}
            disabled={busy || checkingPreflight}
            required
          >
            <option value="">Seleccioná un traslado...</option>
            {eligibleMovements.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.materialType} ({m.quantity} {m.unit})
              </option>
            ))}
          </select>
          <div className="field-hint">
            Solo traslados que exijan documento sanitario y no cuenten con DT-e emitido.
          </div>
        </div>

        {checkingPreflight && (
          <div className="row row-tight small muted">
            <span className="spinner" aria-hidden="true" />
            Verificando condiciones previas con SENASA...
          </div>
        )}

        {preflight && (
          <div style={{ margin: 'var(--sp-2) 0' }}>
            <DteChecks result={preflight} />
          </div>
        )}

        <div className="row" style={{ gap: 'var(--sp-3)' }}>
          <div className="field grow">
            <label className="field-label" htmlFor="dte-load-date">
              Fecha de carga autorizada *
            </label>
            <input
              id="dte-load-date"
              type="date"
              className="field-input"
              value={loadDate}
              onChange={(e) => setLoadDate(e.target.value)}
              disabled={busy}
              required
            />
            <div className="field-hint">Día calendario previsto para el despacho.</div>
          </div>

          <div className="field grow">
            <label className="field-label" htmlFor="dte-expiry-date">
              Fecha de vencimiento *
            </label>
            <input
              id="dte-expiry-date"
              type="date"
              className="field-input"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              disabled={busy}
              required
            />
            <div className="field-hint">Validez oficial de 2 a 4 días (por defecto 3).</div>
          </div>
        </div>

        <div className="row" style={{ gap: 'var(--sp-3)' }}>
          <div className="field grow">
            <label className="field-label" htmlFor="dte-qty">
              Cantidad declarada en DT-e *
            </label>
            <input
              id="dte-qty"
              type="number"
              className="field-input"
              value={declaredQuantity}
              onChange={(e) => setDeclaredQuantity(e.target.value)}
              min="1"
              disabled={busy}
              required
            />
            <div className="field-hint">
              Sugerido +15% de margen: la sala nunca puede recibir más de lo declarado.
            </div>
          </div>

          <div className="field grow">
            <label className="field-label" htmlFor="dte-trans-type">
              Tipo de transporte
            </label>
            <select
              id="dte-trans-type"
              className="field-input"
              value={transportType}
              onChange={(e) => setTransportType(e.target.value)}
              disabled={busy}
            >
              <option value="PROPIO">Transporte propio</option>
              <option value="TERCERO">Transporte de terceros</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
        </div>

        <div className="row" style={{ gap: 'var(--sp-3)' }}>
          <div className="field grow">
            <label className="field-label" htmlFor="dte-plate">
              Patente chasis / vehículo
            </label>
            <input
              id="dte-plate"
              type="text"
              className="field-input mono"
              placeholder="Ej. AB123CD o ABC123"
              value={transportPlate}
              onChange={(e) => handlePlateChange(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="field grow">
            <label className="field-label" htmlFor="dte-trailer">
              Patente acoplado / trailer (opcional)
            </label>
            <input
              id="dte-trailer"
              type="text"
              className="field-input mono"
              placeholder="Ej. 101AA123"
              value={transportTrailerPlate}
              onChange={(e) => handleTrailerPlateChange(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <div className="form-actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!movementId || (preflight !== null && !preflight.ready)}
            busy={busy}
            busyLabel="Creando borrador…"
          >
            Guardar borrador DT-e
          </Button>
        </div>
      </form>
    </Sheet>
  );
};
