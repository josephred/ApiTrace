import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useResource } from '../lib/useResource';
import { formatDateTime } from '../lib/format';
import { LOT_TYPES, gapExplanation } from '../lib/vocabulary';
import { TraceGraph } from '../components/TraceGraph';
import {
  Card,
  EmptyState,
  PageHeader,
  Pill,
  SkeletonList,
  Stat,
  SummaryList,
} from '../components/ui';
import { ResourceNotices } from '../components/ResourceNotices';
import { ChoiceGroup } from '../components/Form';
import type { Apiary, Lot, Paginated, TraceResult } from '../lib/types';

type Direction = 'backward' | 'forward';
type EntityType = 'lot' | 'drum' | 'apiary' | 'producer' | 'establishment' | 'movement';

const ENTITY_LABEL: Record<EntityType, string> = {
  lot: 'Lote',
  drum: 'Tambor',
  apiary: 'Apiario',
  producer: 'Productor',
  establishment: 'Establecimiento',
  movement: 'Movimiento',
};

const buildPath = (direction: Direction, entityType: EntityType, id: string): string => {
  if (direction === 'backward') {
    // El backend expone la consulta hacia atrás desde el lote y desde el tambor,
    // que son los dos puntos de partida naturales de una investigacion.
    return entityType === 'drum' ? `/drums/${id}/trace/backward` : `/lots/${id}/trace/backward`;
  }
  return `/traceability/forward/${entityType}/${id}`;
};

export const TracePage = () => {
  const params = useParams<{ direction?: Direction; entityType?: EntityType; id?: string }>();
  const navigate = useNavigate();

  const [direction, setDirection] = useState<Direction>(params.direction ?? 'backward');
  const [entityType, setEntityType] = useState<EntityType>(params.entityType ?? 'lot');
  const [entityId, setEntityId] = useState(params.id ?? '');

  useEffect(() => {
    if (params.direction) setDirection(params.direction);
    if (params.entityType) setEntityType(params.entityType);
    if (params.id) setEntityId(params.id);
  }, [params.direction, params.entityType, params.id]);

  const lots = useResource<Paginated<Lot>>('/lots?pageSize=100');
  const apiaries = useResource<Paginated<Apiary>>('/apiaries?pageSize=100');

  const path = entityId ? buildPath(direction, entityType, entityId) : null;
  const trace = useResource<TraceResult>(path);

  const options =
    entityType === 'lot'
      ? (lots.data?.data ?? []).map((lot) => ({
          id: lot.id,
          label: `${lot.code} · ${LOT_TYPES.label(lot.lotType)}`,
        }))
      : entityType === 'apiary'
        ? (apiaries.data?.data ?? []).map((apiary) => ({
            id: apiary.id,
            label: apiary.name ? `${apiary.code} — ${apiary.name}` : apiary.code,
          }))
        : [];

  const apply = (nextDirection: Direction, nextEntity: EntityType, nextId: string) => {
    setDirection(nextDirection);
    setEntityType(nextEntity);
    setEntityId(nextId);
    if (nextId) navigate(`/trace/${nextDirection}/${nextEntity}/${nextId}`, { replace: true });
  };

  const onDirection = (value: string) => {
    const next = value as Direction;
    // Hacia atrás solo se puede arrancar de un lote o un tambor; si el punto de
    // partida elegido no sirve para el nuevo sentido, se limpia en vez de
    // fallar con un pedido invalido.
    const keeps = next === 'backward' ? entityType === 'lot' || entityType === 'drum' : true;
    apply(next, keeps ? entityType : 'lot', keeps ? entityId : '');
  };

  const data = trace.data;
  const chainState = !data
    ? null
    : data.gaps.length === 0
      ? { tone: 'success' as const, label: 'Completá', icon: 'checkCircle' as const }
      : data.gaps.some((gap) => gap.severity === 'ERROR')
        ? { tone: 'danger' as const, label: 'Con errores', icon: 'danger' as const }
        : { tone: 'warning' as const, label: 'Con observaciones', icon: 'warning' as const };

  return (
    <div className="stack">
      <PageHeader
        title="Trazabilidad"
        help="trace"
        sub="Reconstrui la cadena hacia atrás o hacia adelante."
      />

      <Card>
        <ChoiceGroup
          label="Qué querés saber"
          value={direction}
          onChange={onDirection}
          options={[
            {
              value: 'backward',
              title: 'De dónde vino',
              description: 'Desde un lote o un tambor hasta el apiario de origen.',
            },
            {
              value: 'forward',
              title: 'Dónde terminó',
              description: 'Desde un origen productivo hasta los lotes y tambores finales.',
            },
          ]}
        />

        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="entityType">
              Punto de partida
            </label>
            <select
              id="entityType"
              value={entityType}
              onChange={(event) => apply(direction, event.target.value as EntityType, '')}
            >
              {(direction === 'backward'
                ? (['lot', 'drum'] as EntityType[])
                : (['apiary', 'lot', 'producer', 'establishment', 'movement'] as EntityType[])
              ).map((type) => (
                <option key={type} value={type}>
                  {ENTITY_LABEL[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="entityId">
              {ENTITY_LABEL[entityType]}
            </label>
            {options.length > 0 ? (
              <select
                id="entityId"
                value={entityId}
                onChange={(event) => apply(direction, entityType, event.target.value)}
              >
                <option value="">Elegí uno</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  id="entityId"
                  value={entityId}
                  onChange={(event) => setEntityId(event.target.value)}
                  onBlur={() => apply(direction, entityType, entityId)}
                  placeholder="Pegá el identificador"
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="field-hint">
                  Se consigue desde la pantalla del {ENTITY_LABEL[entityType].toLowerCase()}.
                </span>
              </>
            )}
          </div>
        </div>
      </Card>

      {!path && (
        <Card>
          <EmptyState
            icon="trace"
            title="Elegí un punto de partida"
            description="Hacia atrás se arranca de un lote o un tambor. Hacia adelante, de un apiario, un productor o un movimiento."
          />
        </Card>
      )}

      {trace.loading && (
        <Card flush>
          <SkeletonList rows={4} />
        </Card>
      )}

      <ResourceNotices resource={trace} />

      {data && !trace.loading && (
        <>
          <div className="grid c4">
            <Stat label="Nodos" value={data.nodes.length} hint={`${data.edges.length} relaciones`} />
            <Stat
              label="Productores"
              value={data.summary.producers.length}
              hint={data.summary.producers[0]?.businessName ?? '—'}
            />
            <Stat
              label="Apiarios"
              value={data.summary.apiaries.length}
              hint={data.summary.apiaries.map((item) => item.code).join(', ') || '—'}
            />
            <Stat
              label="Estado de la cadena"
              value={
                chainState && (
                  <Pill tone={chainState.tone} icon={chainState.icon}>
                    {chainState.label}
                  </Pill>
                )
              }
              hint={
                data.gaps.length === 0
                  ? `generada ${formatDateTime(data.generatedAt)}`
                  : `${data.gaps.length} punto(s) a revisar`
              }
              help="gaps"
            />
          </div>

          {data.gaps.length > 0 && (
            <Card title={`Qué falta para cerrar la cadena (${data.gaps.length})`} help="gaps">
              <div className="stack">
                {data.gaps.map((gap, index) => (
                  <div
                    key={`${gap.code}-${index}`}
                    className={`notice notice-${gap.severity === 'ERROR' ? 'danger' : 'warning'}`}
                  >
                    <div className="notice-body">
                      <div className="notice-title">{gap.message}</div>
                      <div className="small" style={{ opacity: 0.9 }}>
                        {gapExplanation(gap.code)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: 'var(--sp-3)' }}>
                La trazabilidad real rara vez está completa. El sistema prefiere decir qué falta
                antes que mostrar la cadena como si estuviera cerrada.
              </p>
            </Card>
          )}

          <Card
            title={`Cadena ${data.direction === 'backward' ? 'hacia atrás' : 'hacia adelante'}`}
            actions={<span className="small muted desktop-only">Tocá un nodo para ver su detalle</span>}
          >
            <TraceGraph result={data} />
          </Card>

          <div className="grid c2">
            <Card title="Origen productivo">
              <SummaryList
                rows={[
                  {
                    key: 'Productores',
                    value:
                      data.summary.producers.length > 0
                        ? data.summary.producers.map((producer) => (
                            <div key={producer.id}>
                              {producer.businessName}
                              {producer.renapa.length > 0 && (
                                <div className="small muted">
                                  RENAPA {producer.renapa.join(', ')}
                                </div>
                              )}
                            </div>
                          ))
                        : '—',
                  },
                  {
                    key: 'RENSPA',
                    value: <span className="mono">{data.summary.renspa.join(' · ') || '—'}</span>,
                  },
                  {
                    key: 'Establecimientos',
                    value:
                      data.summary.establishments.map((item) => item.name).join(' · ') || '—',
                  },
                ]}
              />
            </Card>

            <Card title="Producto y documentacion">
              <SummaryList
                rows={[
                  {
                    key: 'Movimientos',
                    value:
                      data.summary.movements.length > 0
                        ? data.summary.movements.map((movement) => (
                            <div key={movement.id} className="row row-tight" style={{ justifyContent: 'flex-end' }}>
                              <span className="mono">{movement.code}</span>
                              {movement.dteNumber && (
                                <span className="small muted">DT-e {movement.dteNumber}</span>
                              )}
                            </div>
                          ))
                        : '—',
                  },
                  {
                    key: 'Lotes',
                    value: (
                      <span className="mono">
                        {data.summary.lots.map((lot) => lot.code).join(' · ') || '—'}
                      </span>
                    ),
                  },
                  {
                    key: 'Tambores',
                    value: (
                      <span className="mono">
                        {data.summary.drums.map((drum) => drum.code).join(' · ') || '—'}
                      </span>
                    ),
                  },
                ]}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
