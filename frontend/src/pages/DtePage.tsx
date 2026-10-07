import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { DTE_STATUS_FILTERS, formatDay } from '../lib/dte';
import { INTEGRATION_MODES, statusInfo } from '../lib/vocabulary';
import {
  Button,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  Pill,
  Stat,
  StatusPill,
} from '../components/ui';
import { DataList, type Column } from '../components/DataList';
import { ResourceNotices } from '../components/ResourceNotices';
import { DteWizard } from '../components/DteWizard';
import { DraftBanner } from '../components/Panel';
import type { DteListItem, DteSummary, Paginated } from '../lib/types';

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

  // El panel y el aviso del borrador abren el asistente con /dte?nuevo=1.
  const wantsNew = params.get('nuevo') === '1';
  useEffect(() => {
    if (!wantsNew) return;
    if (canIssue) setCreating(true);
    const next = new URLSearchParams(params);
    next.delete('nuevo');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsNew, canIssue]);

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

      {canIssue && !creating && <DraftBanner onResume={() => setCreating(true)} />}

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
        <DteWizard
          integration={integration ?? null}
          blockedHolders={data?.blockedHolders}
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
