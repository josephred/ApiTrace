import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiSend } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { toUserMessage } from '../lib/errors';
import { directionsUrl, formatPoint } from '../lib/geo';
import type { Zone } from '../lib/cargo';
import { Icon } from '../components/Icon';
import { HexCluster } from '../components/Illustrations';
import { MediaThumb } from '../components/MediaThumb';
import { AppBar } from '../components/Screen';
import {
  Button,
  ButtonLink,
  EmptyState,
  Notice,
  Pill,
  Sheet,
  SkeletonList,
  StatusPill,
  SummaryList,
  useWriteFeedback,
} from '../components/ui';
import { ResourceNotices } from '../components/ResourceNotices';
import { OfficialRegistrySheet } from '../components/OfficialRegistrySheet';
import { FormError } from '../components/Form';
import type { Apiary, Hive, Paginated } from '../lib/types';

const NO_ZONE = 'sin-zona';

/**
 * Maestro de apiarios (doc 13): agrupados por zona, con su foto, su RENAPA y
 * sus colmenas. El alta va a pantalla completa («Nuevo Apiario»); tocar un
 * apiario abre su ficha con colmenas, RENAPA, ubicación y trazabilidad.
 */
export const ApiariesPage = () => {
  const { canWrite } = useAuth();
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Apiary | null>(null);
  const [hivesFor, setHivesFor] = useState<Apiary | null>(null);
  const [renapaFor, setRenapaFor] = useState<Apiary | null>(null);

  const list = useResource<Paginated<Apiary>>('/apiaries?pageSize=200');
  const zones = useResource<Zone[]>('/zones');

  const apiaries = list.data?.data ?? [];
  const totalHives = apiaries.reduce((sum, item) => sum + (item.hiveCount ?? 0), 0);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return apiaries.filter((item) => {
      if (zoneFilter === NO_ZONE ? item.zoneId : zoneFilter && item.zoneId !== zoneFilter) return false;
      if (!term) return true;
      return [item.name, item.code, item.renapaCode, item.zoneName, item.locality]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [apiaries, zoneFilter, query]);

  // Grupos en el orden de las zonas; los apiarios sin zona, al final.
  const groups = useMemo(() => {
    const byZone = new Map<string, { title: string; items: Apiary[] }>();
    for (const item of filtered) {
      const key = item.zoneId ?? NO_ZONE;
      if (!byZone.has(key)) byZone.set(key, { title: item.zoneName ?? 'Sin zona', items: [] });
      byZone.get(key)!.items.push(item);
    }
    return [...byZone.entries()]
      .sort(([a, ga], [b, gb]) => (a === NO_ZONE ? 1 : b === NO_ZONE ? -1 : ga.title.localeCompare(gb.title)))
      .map(([key, group]) => ({ key, ...group }));
  }, [filtered]);

  const noZoneCount = apiaries.filter((item) => !item.zoneId).length;

  return (
    <div className="master-list">
      <AppBar title="Apiarios" back="/carga" />

      <div className="master-summary">
        <span>
          <strong>{apiaries.length}</strong> {apiaries.length === 1 ? 'apiario' : 'apiarios'}
        </span>
        <span>
          <strong>{totalHives}</strong> colmenas
        </span>
        <span>
          <strong>{zones.data?.length ?? 0}</strong> {zones.data?.length === 1 ? 'zona' : 'zonas'}
        </span>
      </div>

      {canWrite && apiaries.length > 0 && (
        <ButtonLink to="/apiaries/nuevo" variant="primary" icon="plus" block>
          Nuevo apiario
        </ButtonLink>
      )}

      <ResourceNotices resource={list} />

      {apiaries.length > 0 && (
        <>
          <div className="search-field">
            <Icon name="search" size={20} />
            <input
              type="search"
              placeholder="Buscar apiario, RENAPA o zona…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Buscar apiario"
            />
          </div>
          <div className="chip-row" role="group" aria-label="Filtrar por zona">
            <button
              type="button"
              className={zoneFilter === '' ? 'chip selected' : 'chip'}
              aria-pressed={zoneFilter === ''}
              onClick={() => setZoneFilter('')}
            >
              Todas ({apiaries.length})
            </button>
            {(zones.data ?? []).map((zone) => (
              <button
                key={zone.id}
                type="button"
                className={zoneFilter === zone.id ? 'chip selected' : 'chip'}
                aria-pressed={zoneFilter === zone.id}
                onClick={() => setZoneFilter(zone.id)}
              >
                {zone.name} ({zone.apiaryCount})
              </button>
            ))}
            {noZoneCount > 0 && (
              <button
                type="button"
                className={zoneFilter === NO_ZONE ? 'chip selected' : 'chip'}
                aria-pressed={zoneFilter === NO_ZONE}
                onClick={() => setZoneFilter(NO_ZONE)}
              >
                Sin zona ({noZoneCount})
              </button>
            )}
          </div>
        </>
      )}

      {list.loading && !list.data && <SkeletonList rows={4} />}

      {!list.loading && apiaries.length === 0 && (
        <EmptyState
          icon="apiaries"
          title="Todavía no hay apiarios"
          description="El apiario es el conjunto de colmenas en un punto concreto. Es lo que permite responder de dónde vino la miel."
          action={
            canWrite && (
              <ButtonLink to="/apiaries/nuevo" variant="primary" icon="plus">
                Registrar el primero
              </ButtonLink>
            )
          }
        />
      )}

      {groups.map((group) => {
        const hives = group.items.reduce((sum, item) => sum + (item.hiveCount ?? 0), 0);
        return (
          <section key={group.key} className="master-group" aria-label={group.title}>
            <h2 className="master-group-title">
              <span>{group.title}</span>
              <span className="master-group-meta">
                {group.items.length} {group.items.length === 1 ? 'apiario' : 'apiarios'} · {hives} colmenas
              </span>
            </h2>
            <ul className="master-rows">
              {group.items.map((item) => (
                <li key={item.id}>
                  <button type="button" className="master-row" onClick={() => setSelected(item)}>
                    <span className="master-row-thumb">
                      <MediaThumb
                        id={item.photoId}
                        alt=""
                        fallback={
                          <span className="master-row-glyph">
                            <HexCluster size={30} />
                          </span>
                        }
                      />
                    </span>
                    <span className="master-row-text">
                      <span className="master-row-title">{item.name ?? item.code}</span>
                      <span className="master-row-sub">
                        {item.renapaCode ? `RENAPA ${item.renapaCode}` : `${item.code} · sin RENAPA`}
                      </span>
                    </span>
                    <span className="master-row-meta">
                      <strong>{item.hiveCount}</strong>
                      <span>colmenas</span>
                    </span>
                    <Icon name="forward" size={22} className="master-row-chevron" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {selected && (
        <ApiarySheet
          apiary={selected}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
          onHives={() => {
            setHivesFor(selected);
            setSelected(null);
          }}
          onRenapa={() => {
            setRenapaFor(selected);
            setSelected(null);
          }}
        />
      )}

      {renapaFor && (
        <OfficialRegistrySheet
          title="RENAPA del apiario"
          subtitle={`Apiario ${renapaFor.name ?? renapaFor.code}`}
          path={`/apiaries/${renapaFor.id}`}
          entity="/apiaries"
          names={{ code: 'renapaCode', status: 'renapaStatus', validTo: 'renapaValidTo' }}
          codeLabel="RENAPA del apiario"
          codePlaceholder="B53999-2"
          help="renapaApiary"
          initial={{
            code: renapaFor.renapaCode,
            status: renapaFor.renapaStatus,
            validTo: renapaFor.renapaValidTo,
          }}
          onClose={() => setRenapaFor(null)}
          onDone={() => {
            setRenapaFor(null);
            list.reload();
          }}
        />
      )}

      {hivesFor && (
        <HivesSheet
          apiary={hivesFor}
          onClose={() => {
            setHivesFor(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   Ficha del apiario
   ========================================================================= */

const ApiarySheet = ({
  apiary,
  canWrite,
  onClose,
  onHives,
  onRenapa,
}: {
  apiary: Apiary;
  canWrite: boolean;
  onClose: () => void;
  onHives: () => void;
  onRenapa: () => void;
}) => {
  const located = apiary.latitude !== null && apiary.longitude !== null;
  return (
    <Sheet title={apiary.name ?? apiary.code} subtitle={apiary.zoneName ?? 'Sin zona'} onClose={onClose}>
      {apiary.photoId && (
        <div className="sheet-photo">
          <MediaThumb id={apiary.photoId} full alt={`Foto del apiario ${apiary.name ?? apiary.code}`} fallback={null} />
        </div>
      )}
      <SummaryList
        rows={[
          { key: 'Código', value: <span className="mono">{apiary.code}</span> },
          {
            key: 'RENAPA',
            value: apiary.renapaCode ? (
              <span className="row row-tight">
                <span className="mono">{apiary.renapaCode}</span>
                {apiary.renapaStatus && <StatusPill status={apiary.renapaStatus} withIcon={false} />}
              </span>
            ) : (
              <span className="faint">Sin cargar: hace falta para el DT-e</span>
            ),
          },
          { key: 'Colmenas', value: String(apiary.hiveCount) },
          { key: 'Predio', value: apiary.establishmentName ?? '—' },
          {
            key: 'Ubicación',
            value: located ? (
              <span className="mono">{formatPoint(apiary.latitude!, apiary.longitude!)}</span>
            ) : (
              <span className="faint">Sin ubicación</span>
            ),
          },
        ]}
      />
      <div className="sheet-actions">
        {canWrite && (
          <Button icon="beehive" onClick={onHives}>
            Colmenas
          </Button>
        )}
        {canWrite && (
          <Button icon="honeycomb" onClick={onRenapa}>
            RENAPA
          </Button>
        )}
        {located && (
          <a className="btn btn-secondary" href={directionsUrl(apiary.latitude!, apiary.longitude!)} target="_blank" rel="noreferrer">
            <Icon name="route" size={17} />
            Cómo llegar
          </a>
        )}
        {located && (
          <Link className="btn btn-secondary" to={`/mapa?lugar=${apiary.id}`}>
            <Icon name="map" size={17} />
            Ver en el mapa
          </Link>
        )}
        <ButtonLink to={`/trace/forward/apiary/${apiary.id}`} icon="trace">
          Dónde terminó
        </ButtonLink>
      </div>
    </Sheet>
  );
};

/* =========================================================================
   Colmenas
   ========================================================================= */

const HivesSheet = ({ apiary, onClose }: { apiary: Apiary; onClose: () => void }) => {
  const hives = useResource<Hive[]>(`/apiaries/${apiary.id}/hives`);
  const [code, setCode] = useState('');
  const [type, setType] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const [queued, setQueued] = useState(0);
  const feedback = useWriteFeedback();

  const addHive = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;

    setBusy(true);
    setFailure(null);
    try {
      const result = await apiSend(
        'POST',
        `/apiaries/${apiary.id}/hives`,
        { code: code.trim(), ...(type.trim() ? { type: type.trim() } : {}) },
        { label: `Colmena ${code} en ${apiary.code}`, entity: '/apiaries' },
      );
      setCode('');
      if (result.queued) setQueued((count) => count + 1);
      else {
        feedback.saved('Colmena agregada', code);
        hives.reload();
      }
    } catch (cause) {
      const message = toUserMessage(cause, 'write');
      setFailure({ title: message.title, detail: message.detail });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Colmenas" subtitle={`Apiario ${apiary.code}`} help="hives" onClose={onClose}>
      {failure && <FormError title={failure.title} detail={failure.detail} />}
      {queued > 0 && (
        <Notice tone="info" title="Guardadas en el dispositivo">
          {queued === 1
            ? '1 colmena se enviará al recuperar la señal.'
            : `${queued} colmenas se enviarán al recuperar la señal.`}
        </Notice>
      )}

      {/* Alta rapida: cargar colmenas es una tarea repetitiva, el campo vuelve a
          quedar vacío y con el foco para encadenar varias seguidas. */}
      <form onSubmit={addHive} style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="hive-code">
              Código
              <span aria-hidden="true" style={{ color: 'var(--danger-fg)' }}>
                *
              </span>
            </label>
            <input
              id="hive-code"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="COL-0001"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="hive-type">
              Tipo
              <span className="field-optional">opcional</span>
            </label>
            <input
              id="hive-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              placeholder="Langstroth"
              autoComplete="off"
            />
          </div>
        </div>
        <Button
          type="submit"
          variant="primary"
          icon="plus"
          block
          busy={busy}
          busyLabel="Agregando…"
          disabled={!code.trim()}
        >
          Agregar colmena
        </Button>
      </form>

      {hives.loading && <SkeletonList rows={3} />}

      {hives.data && hives.data.length > 0 ? (
        <>
          <div className="form-section-title">
            {hives.data.length === 1 ? '1 colmena registrada' : `${hives.data.length} colmenas registradas`}
          </div>
          <div className="dl-cards" style={{ display: 'block' }}>
            {hives.data.map((hive) => (
              <div className="dl-card" key={hive.id}>
                <div className="dl-card-top">
                  <span className="dl-card-title mono">{hive.code}</span>
                  <Pill tone={hive.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {hive.status === 'ACTIVE' ? 'Activa' : hive.status}
                  </Pill>
                </div>
                <div className="small muted">{hive.type ?? 'Sin tipo'}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        !hives.loading && (
          <p className="muted small">Todavía no hay colmenas cargadas en este apiario.</p>
        )
      )}
    </Sheet>
  );
};
