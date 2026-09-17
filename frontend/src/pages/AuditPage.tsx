import { useState } from 'react';
import { useResource } from '../lib/useResource';
import { useDebounced } from '../lib/useDebounced';
import { formatDateTime } from '../lib/format';
import { entityLabel, eventLabel } from '../lib/vocabulary';
import { Icon } from '../components/Icon';
import { Button, Card, EmptyState, PageHeader, Pill } from '../components/ui';
import { DataList, type Column } from '../components/DataList';
import { ResourceNotices } from '../components/ResourceNotices';
import type { AuditEvent, Paginated } from '../lib/types';

const ENTITIES = [
  'movement',
  'lot',
  'drum',
  'producer',
  'establishment',
  'apiary',
  'dte',
  'user',
];

export const AuditPage = () => {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [pageSize, setPageSize] = useState(25);

  const search = useDebounced(action);
  const query = [
    `pageSize=${pageSize}`,
    entityType && `entityType=${entityType}`,
    search && `action=${encodeURIComponent(search)}`,
  ]
    .filter(Boolean)
    .join('&');

  const events = useResource<Paginated<AuditEvent>>(`/audit/events?${query}`);
  const filtered = Boolean(entityType || search);

  const columns: Column<AuditEvent>[] = [
    {
      key: 'action',
      header: 'Acción',
      role: 'title',
      cell: (event) => <strong>{eventLabel(event.action)}</strong>,
    },
    {
      key: 'entity',
      header: 'Entidad',
      role: 'status',
      cell: (event) => <Pill tone="brand">{entityLabel(event.entityType)}</Pill>,
    },
    {
      key: 'when',
      header: 'Momento',
      cell: (event) => <span className="nowrap">{formatDateTime(event.timestamp)}</span>,
    },
    {
      key: 'actor',
      header: 'Quién',
      cell: (event) => event.actorEmail ?? <span className="faint">el sistema</span>,
    },
    {
      key: 'id',
      header: 'Registro',
      role: 'hidden',
      cell: (event) =>
        event.entityId ? <span className="mono small">{event.entityId.slice(0, 8)}</span> : '—',
    },
  ];

  return (
    <div className="stack">
      <PageHeader
        title="Auditoría"
        help="audit"
        sub="Quién hizo qué, sobre qué registro y cuándo."
      />

      <ResourceNotices resource={events} />

      <div className="filters">
        <select
          value={entityType}
          onChange={(event) => setEntityType(event.target.value)}
          aria-label="Filtrar por tipo de registro"
        >
          <option value="">Todos los registros</option>
          {ENTITIES.map((option) => (
            <option key={option} value={option}>
              {entityLabel(option)}
            </option>
          ))}
        </select>
        <div className="search-wrap">
          <Icon name="search" size={17} />
          <input
            type="search"
            placeholder="Buscar acción, p. ej. MOVEMENT_CREATED"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            aria-label="Filtrar por acción"
          />
        </div>
        {filtered && (
          <Button
            size="sm"
            icon="close"
            onClick={() => {
              setEntityType('');
              setAction('');
            }}
          >
            Limpiar
          </Button>
        )}
      </div>

      <Card flush>
        <DataList
          items={events.data?.data ?? []}
          columns={columns}
          rowKey={(event) => event.id}
          loading={events.loading}
          total={events.data?.meta.total}
          onLoadMore={() => setPageSize((size) => size + 25)}
          loadingMore={events.loading}
          empty={
            <EmptyState
              icon="audit"
              title={filtered ? 'Sin resultados' : 'Todavía no hay eventos'}
              description={
                filtered
                  ? 'Probá con otro filtro.'
                  : 'Cada acción sobre el sistema queda registrada acá automáticamente.'
              }
              action={
                filtered && (
                  <Button
                    icon="close"
                    onClick={() => {
                      setEntityType('');
                      setAction('');
                    }}
                  >
                    Limpiar filtros
                  </Button>
                )
              }
            />
          }
        />
      </Card>
    </div>
  );
};
