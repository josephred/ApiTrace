import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { directionsUrl, formatPoint } from '../lib/geo';
import { Icon, type IconName } from '../components/Icon';
import { PlaceGlyph } from '../components/Illustrations';
import { MediaThumb } from '../components/MediaThumb';
import { AppBar } from '../components/Screen';
import { ButtonLink, EmptyState, Sheet, SkeletonList, StatusPill, SummaryList } from '../components/ui';
import { ResourceNotices } from '../components/ResourceNotices';
import { OfficialRegistrySheet } from '../components/OfficialRegistrySheet';
import { SALA_KINDS, type SalaKind } from '../lib/salas';
import type { Establishment, Paginated, UserRole } from '../lib/types';

interface Shortcut {
  to: string;
  label: string;
  icon: IconName;
  roles: UserRole[];
}

const SHORTCUTS: Record<SalaKind, Shortcut[]> = {
  extraccion: [
    { to: '/dte?perspective=recibidos', label: 'DT-e recibidos', icon: 'inbox', roles: ['ADMIN', 'SALA', 'ACOPIADOR', 'AUDITOR'] },
    { to: '/extractions', label: 'Extracciones', icon: 'extractions', roles: ['ADMIN', 'SALA', 'ACOPIADOR', 'AUDITOR'] },
    { to: '/drums', label: 'Tambores', icon: 'drums', roles: ['ADMIN', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'EXPORTADOR', 'AUDITOR'] },
  ],
  fraccionamiento: [
    { to: '/lots', label: 'Lotes', icon: 'lots', roles: ['ADMIN', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'LABORATORIO', 'AUDITOR'] },
    { to: '/drums', label: 'Tambores', icon: 'drums', roles: ['ADMIN', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'EXPORTADOR', 'AUDITOR'] },
    { to: '/trace', label: 'Trazabilidad', icon: 'trace', roles: [] },
  ],
};

/**
 * Maestro de salas (doc 13): las salas de extracción o de fraccionamiento
 * propias, con su foto, su RNE y su habilitación, y los accesos a lo que se
 * registra en ellas (tambores, extracciones, lotes).
 */
export const SalasPage = () => {
  const { kind } = useParams<{ kind: SalaKind }>();
  const { user, canWrite } = useAuth();
  const valid = kind === 'extraccion' || kind === 'fraccionamiento';
  const spec = valid ? SALA_KINDS[kind] : null;
  const list = useResource<Paginated<Establishment>>(
    spec ? `/establishments?type=${spec.type}&pageSize=100` : null,
  );
  const [selected, setSelected] = useState<Establishment | null>(null);
  const [senasaFor, setSenasaFor] = useState<Establishment | null>(null);

  if (!valid || !spec) return <Navigate to="/carga" replace />;

  const salas = list.data?.data ?? [];
  const role = user?.role;
  const shortcuts = SHORTCUTS[kind].filter(
    (item) => item.roles.length === 0 || (role && (role === 'ADMIN' || item.roles.includes(role))),
  );
  const plural = kind === 'extraccion' ? 'Salas de extracción' : 'Salas de fraccionamiento';

  return (
    <div className="master-list">
      <AppBar title={plural} back="/carga" />

      {shortcuts.length > 0 && (
        <nav className="shortcut-row" aria-label="Accesos">
          {shortcuts.map((item) => (
            <Link key={item.to} to={item.to} className="shortcut">
              <Icon name={item.icon} size={22} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      )}

      {canWrite && salas.length > 0 && (
        <ButtonLink to={`/salas/${kind}/nueva`} variant="primary" icon="plus" block>
          Nueva {spec.noun}
        </ButtonLink>
      )}

      <ResourceNotices resource={list} />
      {list.loading && !list.data && <SkeletonList rows={3} />}

      {!list.loading && salas.length === 0 && (
        <EmptyState
          icon="establishments"
          title={`Todavía no registraste ${kind === 'extraccion' ? 'salas de extracción' : 'salas de fraccionamiento'}`}
          description={
            kind === 'extraccion'
              ? 'La sala recibe las alzas, cierra el DT-e y registra los tambores. Si llevás tus alzas a la sala de otro, no hace falta cargarla: ya figura como destino.'
              : 'En la sala de fraccionamiento la miel de los tambores pasa a frascos y lotes de producto.'
          }
          action={
            canWrite && (
              <ButtonLink to={`/salas/${kind}/nueva`} variant="primary" icon="plus">
                Registrar {spec.noun}
              </ButtonLink>
            )
          }
        />
      )}

      {salas.length > 0 && (
        <ul className="master-rows">
          {salas.map((sala) => (
            <li key={sala.id}>
              <button type="button" className="master-row" onClick={() => setSelected(sala)}>
                <span className="master-row-thumb">
                  <MediaThumb
                    id={sala.photoId}
                    alt=""
                    fallback={
                      <span className="master-row-glyph">
                        <PlaceGlyph type="STORE" size={28} />
                      </span>
                    }
                  />
                </span>
                <span className="master-row-text">
                  <span className="master-row-title">{sala.name}</span>
                  <span className="master-row-sub">
                    {sala.senasaCode
                      ? `Habilitación: ${sala.senasaCode}`
                      : sala.rne
                        ? `RNE: ${sala.rne}`
                        : 'Sin RNE ni habilitación'}
                  </span>
                </span>
                {sala.latitude && sala.longitude ? (
                  <Icon name="pin" size={18} className="master-row-flag" aria-label="Con ubicación" />
                ) : null}
                <Icon name="forward" size={22} className="master-row-chevron" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <Sheet title={selected.name} subtitle={spec.title} onClose={() => setSelected(null)}>
          {selected.photoId && (
            <div className="sheet-photo">
              <MediaThumb id={selected.photoId} full alt={`Foto de ${selected.name}`} fallback={null} />
            </div>
          )}
          <SummaryList
            rows={[
              { key: 'RNE', value: selected.rne ? <span className="mono">{selected.rne}</span> : '—' },
              {
                key: 'Habilitación SENASA',
                value: selected.senasaCode ? (
                  <span className="row row-tight">
                    <span className="mono">{selected.senasaCode}</span>
                    {selected.senasaStatus && <StatusPill status={selected.senasaStatus} withIcon={false} />}
                  </span>
                ) : (
                  <span className="faint">Sin cargar</span>
                ),
              },
              {
                key: 'Ubicación',
                value:
                  selected.latitude && selected.longitude ? (
                    <span className="mono">{formatPoint(selected.latitude, selected.longitude)}</span>
                  ) : (
                    <span className="faint">Sin ubicación</span>
                  ),
              },
              { key: 'Estado', value: <StatusPill status={selected.status} /> },
            ]}
          />
          <div className="sheet-actions">
            {canWrite && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSenasaFor(selected);
                  setSelected(null);
                }}
              >
                <Icon name="rules" size={17} />
                Habilitación SENASA
              </button>
            )}
            {selected.latitude && selected.longitude && (
              <a
                className="btn btn-secondary"
                href={directionsUrl(selected.latitude, selected.longitude)}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="route" size={17} />
                Cómo llegar
              </a>
            )}
            {selected.latitude && selected.longitude && (
              <Link className="btn btn-secondary" to={`/mapa?lugar=${selected.id}`}>
                <Icon name="map" size={17} />
                Ver en el mapa
              </Link>
            )}
          </div>
        </Sheet>
      )}

      {senasaFor && (
        <OfficialRegistrySheet
          title="Habilitación SENASA"
          subtitle={senasaFor.name}
          path={`/establishments/${senasaFor.id}`}
          entity="/establishments"
          names={{ code: 'senasaCode', status: 'senasaStatus', validTo: 'senasaValidTo' }}
          codeLabel="Código de la sala"
          codePlaceholder="SEF-B-20010"
          help="senasaSala"
          initial={{
            code: senasaFor.senasaCode ?? null,
            status: senasaFor.senasaStatus,
            validTo: senasaFor.senasaValidTo ?? null,
          }}
          onClose={() => setSenasaFor(null)}
          onDone={() => {
            setSenasaFor(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
};
