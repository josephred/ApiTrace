import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiSend } from '../lib/api';
import { useAuth } from '../lib/auth';
import { invalidateCache } from '../lib/db';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { useResource } from '../lib/useResource';
import { directionsUrl, formatPoint } from '../lib/geo';
import type { Zone } from '../lib/cargo';
import { cleanRenspa, FINCA_TYPE, renspaError } from '../lib/fincas';
import { Icon } from '../components/Icon';
import { PlaceGlyph } from '../components/Illustrations';
import { MediaThumb } from '../components/MediaThumb';
import { AppBar } from '../components/Screen';
import {
  Button,
  ButtonLink,
  EmptyState,
  Sheet,
  SkeletonList,
  SummaryList,
  useWriteFeedback,
} from '../components/ui';
import { ResourceNotices } from '../components/ResourceNotices';
import { Fields, Form, FormError, useForm, type FieldSpec } from '../components/Form';
import type { Establishment, Paginated } from '../lib/types';

const NO_ZONE = 'sin-zona';

const hivesText = (count: number | null | undefined): string =>
  count === null || count === undefined
    ? 'Sin dato'
    : `${count} ${count === 1 ? 'colmena' : 'colmenas'}`;

/**
 * Maestro de fincas de polinización (doc 14): los campos a los que el
 * apicultor lleva colmenas a polinizar, agrupados por zona como los apiarios,
 * con su RENSPA y sus colmenas. El alta va a pantalla completa («Finca /
 * Polinización»); tocar una finca abre su ficha.
 */
export const FincasPage = () => {
  const { canWrite } = useAuth();
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Establishment | null>(null);
  const [editing, setEditing] = useState<Establishment | null>(null);

  const list = useResource<Paginated<Establishment>>(
    `/establishments?type=${FINCA_TYPE}&pageSize=200`,
  );
  const zones = useResource<Zone[]>('/zones');

  const fincas = list.data?.data ?? [];
  const totalHives = fincas.reduce((sum, item) => sum + (item.hiveCount ?? 0), 0);
  const usedZones = new Set(fincas.map((item) => item.zoneId).filter(Boolean)).size;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return fincas.filter((item) => {
      if (zoneFilter === NO_ZONE ? item.zoneId : zoneFilter && item.zoneId !== zoneFilter)
        return false;
      if (!term) return true;
      return [item.name, item.renspaNumber, item.zoneName, item.locality]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [fincas, zoneFilter, query]);

  // Grupos en el orden de las zonas; las fincas sin zona, al final.
  const groups = useMemo(() => {
    const byZone = new Map<string, { title: string; items: Establishment[] }>();
    for (const item of filtered) {
      const key = item.zoneId ?? NO_ZONE;
      if (!byZone.has(key)) byZone.set(key, { title: item.zoneName ?? 'Sin zona', items: [] });
      byZone.get(key)!.items.push(item);
    }
    return [...byZone.entries()]
      .sort(([a, ga], [b, gb]) =>
        a === NO_ZONE ? 1 : b === NO_ZONE ? -1 : ga.title.localeCompare(gb.title),
      )
      .map(([key, group]) => ({ key, ...group }));
  }, [filtered]);

  const zonesWithFincas = (zones.data ?? []).filter((zone) => (zone.fincaCount ?? 0) > 0);
  const noZoneCount = fincas.filter((item) => !item.zoneId).length;

  return (
    <div className="master-list">
      <AppBar title="Fincas de polinización" back="/carga" />

      <div className="master-summary">
        <span>
          <strong>{fincas.length}</strong> {fincas.length === 1 ? 'finca' : 'fincas'}
        </span>
        <span>
          <strong>{totalHives}</strong> colmenas
        </span>
        <span>
          <strong>{usedZones}</strong> {usedZones === 1 ? 'zona' : 'zonas'}
        </span>
      </div>

      {canWrite && fincas.length > 0 && (
        <ButtonLink to="/fincas/nueva" variant="primary" icon="plus" block>
          Nueva finca
        </ButtonLink>
      )}

      <ResourceNotices resource={list} />

      {fincas.length > 0 && (
        <>
          <div className="search-field">
            <Icon name="search" size={20} />
            <input
              type="search"
              placeholder="Buscar finca, RENSPA o zona…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Buscar finca"
            />
          </div>
          {(zonesWithFincas.length > 0 || noZoneCount > 0) && (
            <div className="chip-row" role="group" aria-label="Filtrar por zona">
              <button
                type="button"
                className={zoneFilter === '' ? 'chip selected' : 'chip'}
                aria-pressed={zoneFilter === ''}
                onClick={() => setZoneFilter('')}
              >
                Todas ({fincas.length})
              </button>
              {zonesWithFincas.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  className={zoneFilter === zone.id ? 'chip selected' : 'chip'}
                  aria-pressed={zoneFilter === zone.id}
                  onClick={() => setZoneFilter(zone.id)}
                >
                  {zone.name} ({zone.fincaCount})
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
          )}
        </>
      )}

      {list.loading && !list.data && <SkeletonList rows={3} />}

      {!list.loading && fincas.length === 0 && (
        <EmptyState
          icon="flower"
          title="Todavía no registraste fincas"
          description="La finca es el campo al que llevás tus colmenas a polinizar. Registrala una vez y queda lista como destino del DT-e de colmenas."
          action={
            canWrite && (
              <ButtonLink to="/fincas/nueva" variant="primary" icon="plus">
                Registrar la primera
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
                {group.items.length} {group.items.length === 1 ? 'finca' : 'fincas'} · {hives}{' '}
                colmenas
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
                            <PlaceGlyph type="FINCA_POLINIZACION" size={28} />
                          </span>
                        }
                      />
                    </span>
                    <span className="master-row-text">
                      <span className="master-row-title">{item.name}</span>
                      <span className="master-row-sub">
                        {item.renspaNumber ? `RENSPA ${item.renspaNumber}` : 'Sin RENSPA'}
                      </span>
                    </span>
                    <span className="master-row-meta">
                      <strong>{item.hiveCount ?? '—'}</strong>
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
        <FincaSheet
          finca={selected}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
        />
      )}

      {editing && (
        <FincaDataSheet
          finca={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   Ficha de la finca
   ========================================================================= */

const FincaSheet = ({
  finca,
  canWrite,
  onClose,
  onEdit,
}: {
  finca: Establishment;
  canWrite: boolean;
  onClose: () => void;
  onEdit: () => void;
}) => {
  const located = Boolean(finca.latitude && finca.longitude);
  return (
    <Sheet title={finca.name} subtitle={finca.zoneName ?? 'Sin zona'} onClose={onClose}>
      {finca.photoId && (
        <div className="sheet-photo">
          <MediaThumb
            id={finca.photoId}
            full
            alt={`Foto de la finca ${finca.name}`}
            fallback={null}
          />
        </div>
      )}
      <SummaryList
        rows={[
          {
            key: 'RENSPA',
            value: finca.renspaNumber ? (
              <span className="mono">{finca.renspaNumber}</span>
            ) : (
              <span className="faint">Sin cargar: es el destino del DT-e de colmenas</span>
            ),
          },
          { key: 'Colmenas a polinizar', value: hivesText(finca.hiveCount) },
          {
            key: 'Zona',
            value: finca.zoneName ?? <span className="faint">Sin zona</span>,
          },
          {
            key: 'Ubicación',
            value: located ? (
              <span className="mono">{formatPoint(finca.latitude!, finca.longitude!)}</span>
            ) : (
              <span className="faint">Sin ubicación</span>
            ),
          },
        ]}
      />
      <div className="sheet-actions">
        {canWrite && (
          <Button icon="document" onClick={onEdit}>
            RENSPA y colmenas
          </Button>
        )}
        {located && (
          <a
            className="btn btn-secondary"
            href={directionsUrl(finca.latitude!, finca.longitude!)}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="route" size={17} />
            Cómo llegar
          </a>
        )}
        {located && (
          <Link className="btn btn-secondary" to={`/mapa?lugar=${finca.id}`}>
            <Icon name="map" size={17} />
            Ver en el mapa
          </Link>
        )}
      </div>
    </Sheet>
  );
};

/* =========================================================================
   RENSPA y colmenas, después del alta
   ========================================================================= */

/**
 * El RENSPA es opcional al registrar la finca (lo decidió Rodrigo): acá se
 * completa, se corrige o se quita, junto con las colmenas de la temporada.
 */
const FincaDataSheet = ({
  finca,
  onClose,
  onDone,
}: {
  finca: Establishment;
  onClose: () => void;
  onDone: () => void;
}) => {
  const fields: FieldSpec[] = [
    {
      name: 'renspaNumber',
      label: 'RENSPA del campo',
      full: true,
      placeholder: 'Ej. 01.002.0.00123/45',
      hint: 'Dejalo vacío para quitarlo.',
      defaultValue: finca.renspaNumber ?? '',
      autoComplete: 'off',
      validate: (value) => renspaError(value),
    },
    {
      name: 'hiveCount',
      label: 'Colmenas que llevás a polinizar',
      type: 'number',
      inputMode: 'numeric',
      min: '0',
      max: '100000',
      step: '1',
      defaultValue:
        finca.hiveCount === null || finca.hiveCount === undefined ? '' : String(finca.hiveCount),
      validate: (value) =>
        value === '' || (/^\d+$/.test(value) && Number(value) <= 100000)
          ? null
          : 'Escribí un número entero de 0 a 100000.',
    },
  ];

  const { values, set, blur, errors, setErrors, validateAll } = useForm(fields);
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
      const hives = values.hiveCount.trim();
      const body: Record<string, unknown> = {
        renspaNumber: cleanRenspa(values.renspaNumber),
        ...(hives !== '' ? { hiveCount: Number(hives) } : {}),
      };
      const result = await apiSend('PATCH', `/establishments/${finca.id}`, body, {
        label: `Finca ${finca.name}`,
        entity: '/establishments',
      });
      await invalidateCache('/places');
      if (result.queued) feedback.queued('El cambio');
      else feedback.saved('Finca actualizada', finca.name);
      onDone();
    } catch (cause) {
      const perField = fieldErrors(cause, ['renspaNumber', 'hiveCount']);
      if (Object.keys(perField).length > 0) setErrors(perField);
      else {
        const message = toUserMessage(cause, 'write');
        setFailure({ title: message.title, detail: message.detail });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="RENSPA y colmenas" subtitle={finca.name} onClose={onClose} narrow>
      <Form
        onSubmit={submit}
        error={failure && <FormError title={failure.title} detail={failure.detail} />}
        submitLabel="Guardar"
        busyLabel="Guardando…"
        onCancel={onClose}
        busy={busy}
      >
        <Fields fields={fields} values={values} errors={errors} onChange={set} onBlur={blur} />
      </Form>
    </Sheet>
  );
};
