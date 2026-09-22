import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useSync } from '../lib/sync';
import { useResource } from '../lib/useResource';
import { formatQuantity, formatRelative } from '../lib/format';
import { MATERIAL_TYPES } from '../lib/vocabulary';
import { Icon, type IconName } from '../components/Icon';
import {
  ButtonLink,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  Stat,
  StatusPill,
} from '../components/ui';
import { DataList, type Column } from '../components/DataList';
import type {
  Apiary,
  Drum,
  DteSummary,
  Establishment,
  Extraction,
  Lot,
  Movement,
  Paginated,
} from '../lib/types';

/* =========================================================================
   Tarjeta de tarea
   ========================================================================= */

/**
 * El panel anterior mostraba recuentos: cuantos movimientos, cuantos lotes.
 * Un número no le dice a nadie qué tiene qué hacer. Estas tarjetas solo
 * aparecen cuando hay algo pendiente de verdad, y llevan directo a resolverlo.
 */
const TaskCard = ({
  icon,
  tone,
  title,
  detail,
  to,
  cta,
}: {
  icon: IconName;
  tone: 'warning' | 'danger' | 'info';
  title: string;
  detail: string;
  to: string;
  cta: string;
}) => (
  <Link
    to={to}
    className="card"
    style={{
      display: 'flex',
      gap: 'var(--sp-4)',
      padding: 'var(--sp-4)',
      alignItems: 'flex-start',
      color: 'inherit',
      fontWeight: 400,
      borderColor: `var(--${tone}-br)`,
    }}
  >
    <span
      style={{
        width: 38,
        height: 38,
        borderRadius: 'var(--r-full)',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        background: `var(--${tone}-bg)`,
        color: `var(--${tone}-fg)`,
      }}
    >
      <Icon name={icon} size={19} />
    </span>
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontWeight: 650 }}>{title}</span>
      <span className="small muted" style={{ display: 'block' }}>
        {detail}
      </span>
      <span
        className="small"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 'var(--sp-2)', color: 'var(--primary)', fontWeight: 650 }}
      >
        {cta}
        <Icon name="forward" size={14} />
      </span>
    </span>
  </Link>
);

/* =========================================================================
   Tareas del DT-e
   ========================================================================= */

interface TaskSpec {
  key: string;
  icon: IconName;
  tone: 'warning' | 'danger' | 'info';
  title: string;
  detail: string;
  to: string;
  cta: string;
}

const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

/**
 * Lo que el DT-e exige hacer hoy. Quien emite ve caducados, vencidos y
 * borradores; la sala, lo que tiene que cerrar. El orden es el de la urgencia:
 * un DT-e caducado bloquea al productor, uno vencido todavia puede cerrarse.
 */
const dteTasks = (
  tasks: DteSummary['tasks'],
  issuer: boolean,
  receiver: boolean,
): TaskSpec[] => {
  const list: TaskSpec[] = [];
  if (issuer && tasks.lapsed > 0) {
    list.push({
      key: 'lapsed',
      icon: 'danger',
      tone: 'danger',
      title: count(tasks.lapsed, 'Un DT-e caducado', 'DT-e caducados'),
      detail: 'SIGSA no deja emitir nuevos DT-e al titular hasta regularizar ante SENASA.',
      to: '/dte?perspective=emitidos&status=CADUCADO',
      cta: 'Ver caducados',
    });
  }
  if (issuer && tasks.requestErrors > 0) {
    list.push({
      key: 'requestErrors',
      icon: 'danger',
      tone: 'danger',
      title: count(tasks.requestErrors, 'Una solicitud a SIGSA falló', 'solicitudes a SIGSA fallaron'),
      detail: 'Se reintentan solas; si el error persiste, revisá los datos del DT-e.',
      to: '/dte?perspective=emitidos&status=SOLICITADO',
      cta: 'Ver solicitudes',
    });
  }
  if (receiver && tasks.pendingClosure > 0) {
    list.push({
      key: 'pendingClosure',
      icon: 'inbox',
      tone: tasks.receivedExpired > 0 ? 'danger' : 'warning',
      title: count(tasks.pendingClosure, 'Un DT-e por cerrar en sala', 'DT-e por cerrar en sala'),
      detail:
        tasks.receivedExpired > 0
          ? `${count(tasks.receivedExpired, 'Uno ya venció', 'ya vencieron')}: cerralos antes de que caduquen.`
          : 'Al descargar, confirmá las alzas con el código de cierre impreso.',
      to: '/dte?perspective=recibidos',
      cta: 'Cerrar DT-e',
    });
  }
  if (issuer && tasks.expired > 0) {
    list.push({
      key: 'expired',
      icon: 'warning',
      tone: 'warning',
      title: count(tasks.expired, 'Un DT-e vencido sin cierre', 'DT-e vencidos sin cierre'),
      detail: 'La sala tiene 4 días para cerrarlos; después caducan y bloquean nuevas emisiones.',
      to: '/dte?perspective=emitidos&status=VENCIDO',
      cta: 'Ver vencidos',
    });
  }
  if (issuer && tasks.expiringToday > 0) {
    list.push({
      key: 'expiringToday',
      icon: 'warning',
      tone: 'warning',
      title: count(tasks.expiringToday, 'Un DT-e vence hoy', 'DT-e vencen hoy'),
      detail: 'Transitan hasta las 23:59. Si la carga no sale hoy, emití uno nuevo.',
      to: '/dte?perspective=emitidos&status=VIGENTE',
      cta: 'Ver vigentes',
    });
  }
  if (issuer && tasks.draftsToIssue > 0) {
    list.push({
      key: 'drafts',
      icon: 'document',
      tone: 'info',
      title: count(tasks.draftsToIssue, 'Un DT-e en borrador', 'DT-e en borrador'),
      detail: 'Todavía no tienen número: no amparan ningún traslado.',
      to: '/dte?perspective=emitidos&status=BORRADOR',
      cta: 'Emitir',
    });
  }
  return list;
};

/* =========================================================================
   Panel
   ========================================================================= */

export const DashboardPage = () => {
  const { user } = useAuth();
  const { online, pendingCount, failedCount, lastSyncAt } = useSync();

  const role = user?.role;
  const isProducer = role === 'PRODUCTOR';
  const isSala = role === 'SALA';
  const isStock = role === 'ACOPIADOR' || role === 'FRACCIONADOR' || role === 'EXPORTADOR';

  const movements = useResource<Paginated<Movement>>('/movements?pageSize=5');
  const awaiting = useResource<Paginated<Movement>>('/movements?status=DISPATCHED&pageSize=1');
  const drafts = useResource<Paginated<Movement>>('/movements?status=DRAFT&pageSize=1');

  const lots = useResource<Paginated<Lot>>(!isProducer ? '/lots?pageSize=5' : null);
  const apiaries = useResource<Paginated<Apiary>>(
    isProducer || role === 'ADMIN' || role === 'AUDITOR' ? '/apiaries?pageSize=5' : null,
  );
  const establishments = useResource<Paginated<Establishment>>(
    isProducer ? '/establishments?pageSize=1' : null,
  );
  const extractions = useResource<Paginated<Extraction>>(isSala ? '/extractions?pageSize=1' : null);
  const drums = useResource<Paginated<Drum>>(isStock ? '/drums?pageSize=1' : null);

  const dteIssuer = role === 'ADMIN' || role === 'PRODUCTOR';
  const dteReceiver = role === 'ADMIN' || role === 'SALA' || role === 'ACOPIADOR';
  const dteSummary = useResource<DteSummary>(dteIssuer || dteReceiver ? '/dte/summary' : null);
  const dteCards = dteSummary.data
    ? dteTasks(dteSummary.data.tasks, dteIssuer, dteReceiver)
    : [];

  const stale = movements.fromCache || lots.fromCache || apiaries.fromCache;
  const firstName = user?.fullName.split(' ')[0] ?? '';

  const awaitingTotal = awaiting.data?.meta.total ?? 0;
  const draftTotal = drafts.data?.meta.total ?? 0;
  const hasTasks = failedCount > 0 || awaitingTotal > 0 || draftTotal > 0 || dteCards.length > 0;

  const movementColumns: Column<Movement>[] = [
    {
      key: 'code',
      header: 'Código',
      role: 'title',
      cell: (item) => <span className="mono">{item.code}</span>,
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
  ];

  const lotColumns: Column<Lot>[] = [
    {
      key: 'code',
      header: 'Código',
      role: 'title',
      cell: (item) => <span className="mono">{item.code}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      role: 'status',
      cell: (item) => <StatusPill status={item.status} />,
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
        title={firstName ? `Hola, ${firstName}` : 'Panel'}
        sub="Esto es lo que necesita tu atención hoy."
        actions={
          <ButtonLink to="/trace" variant="primary" icon="trace">
            Consultar trazabilidad
          </ButtonLink>
        }
      />

      {stale && (
        <Notice tone="warning" title="Estas viendo una copia local">
          Guardada {formatRelative(lastSyncAt)}. Se actualiza sola al recuperar la conexión.
        </Notice>
      )}

      {/* ------------------------------------------------------ qué hacer */}
      {hasTasks && (
        <div className="grid c2">
          {failedCount > 0 && (
            <TaskCard
              icon="danger"
              tone="danger"
              title={
                failedCount === 1
                  ? 'Una operación fue rechazada'
                  : `${failedCount} operaciones fueron rechazadas`
              }
              detail="El servidor no las aceptó. Hay que revisarlas antes de reintentar."
              to="/pending"
              cta="Revisar la cola"
            />
          )}
          {dteCards.map(({ key, ...card }) => (
            <TaskCard key={key} {...card} />
          ))}
          {awaitingTotal > 0 && (
            <TaskCard
              icon="movements"
              tone="warning"
              title={
                awaitingTotal === 1
                  ? 'Un traslado espera recepción'
                  : `${awaitingTotal} traslados esperan recepción`
              }
              detail="Salieron del origen y todavía nadie registró que llegaron."
              to="/movements?status=DISPATCHED"
              cta="Ver traslados"
            />
          )}
          {draftTotal > 0 && (
            <TaskCard
              icon="document"
              tone="info"
              title={
                draftTotal === 1 ? 'Un movimiento sin despachar' : `${draftTotal} movimientos sin despachar`
              }
              detail="Están creados pero todavía no salieron del establecimiento."
              to="/movements?status=DRAFT"
              cta="Ver borradores"
            />
          )}
        </div>
      )}

      {/* --------------------------------------------------------- cifras */}
      <div className="grid c4">
        <Stat label="Movimientos" value={movements.data?.meta.total ?? '—'} hint="en tu ámbito" help="movements" />

        {isProducer ? (
          <>
            <Stat label="Apiarios" value={apiaries.data?.meta.total ?? '—'} hint="unidades productivas" help="apiaries" />
            <Stat
              label="Establecimientos"
              value={establishments.data?.meta.total ?? '—'}
              hint="predios registrados"
              help="establishments"
            />
          </>
        ) : isSala ? (
          <>
            <Stat label="Extracciones" value={extractions.data?.meta.total ?? '—'} hint="procesos" help="extractions" />
            <Stat label="Lotes" value={lots.data?.meta.total ?? '—'} hint="unidades de trazabilidad" help="lots" />
          </>
        ) : isStock ? (
          <>
            <Stat label="Lotes" value={lots.data?.meta.total ?? '—'} hint="en acopio" help="lots" />
            <Stat label="Tambores" value={drums.data?.meta.total ?? '—'} hint="en inventario" help="drums" />
          </>
        ) : (
          <>
            <Stat label="Lotes" value={lots.data?.meta.total ?? '—'} hint="unidades de trazabilidad" help="lots" />
            <Stat label="Apiarios" value={apiaries.data?.meta.total ?? '—'} hint="unidades productivas" help="apiaries" />
          </>
        )}

        <Stat
          label="Por enviar"
          value={pendingCount + failedCount}
          hint={online ? 'se envían solas' : 'esperando señal'}
          help="pending"
        />
      </div>

      {/* --------------------------------------------------------- listas */}
      <div className="grid c2">
        <Card
          title="Últimos movimientos"
          actions={
            <ButtonLink to="/movements" size="sm">
              Ver todos
            </ButtonLink>
          }
          flush
        >
          <DataList
            items={movements.data?.data ?? []}
            columns={movementColumns}
            rowKey={(item) => item.id}
            rowHref={(item) => `/movements/${item.id}`}
            loading={movements.loading}
            empty={
              <EmptyState
                icon="movements"
                title="Todavía no hay movimientos"
                description="Un movimiento conecta un origen con un destino. Es el evento que arranca toda la trazabilidad."
                action={
                  <ButtonLink to="/movements" variant="primary" icon="plus">
                    Registrar el primero
                  </ButtonLink>
                }
              />
            }
          />
        </Card>

        {isProducer ? (
          <Card
            title="Mis apiarios"
            help="apiaries"
            actions={
              <ButtonLink to="/apiaries" size="sm">
                Ver todos
              </ButtonLink>
            }
            flush
          >
            <DataList
              items={apiaries.data?.data ?? []}
              columns={[
                {
                  key: 'code',
                  header: 'Código',
                  role: 'title',
                  cell: (item: Apiary) => <span className="mono">{item.code}</span>,
                },
                {
                  key: 'status',
                  header: 'Estado',
                  role: 'status',
                  cell: (item: Apiary) => <StatusPill status={item.status} />,
                },
                { key: 'name', header: 'Nombre', cell: (item: Apiary) => item.name ?? '—' },
                {
                  key: 'hives',
                  header: 'Colmenas',
                  align: 'right',
                  cell: (item: Apiary) => item.hiveCount,
                },
              ]}
              rowKey={(item) => item.id}
              loading={apiaries.loading}
              empty={
                <EmptyState
                  icon="apiaries"
                  title="Todavía no hay apiarios"
                  description="El apiario es el punto de partida de la trazabilidad: permite responder de dónde vino la miel."
                  action={
                    <ButtonLink to="/apiaries" variant="primary" icon="plus">
                      Registrar apiario
                    </ButtonLink>
                  }
                />
              }
            />
          </Card>
        ) : (
          <Card
            title="Últimos lotes"
            help="lots"
            actions={
              <ButtonLink to="/lots" size="sm">
                Ver todos
              </ButtonLink>
            }
            flush
          >
            <DataList
              items={lots.data?.data ?? []}
              columns={lotColumns}
              rowKey={(item) => item.id}
              rowHref={(item) => `/lots/${item.id}`}
              loading={lots.loading}
              empty={
                <EmptyState
                  icon="lots"
                  title="Todavía no hay lotes"
                  description="El lote agrupa lo extraido o acopiado y se materializa en tambores."
                />
              }
            />
          </Card>
        )}
      </div>
    </div>
  );
};
