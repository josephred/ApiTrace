import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { DRAFT_STEP_NAMES, useDteDraft } from '../lib/dteDraft';
import { validityWindow } from '../lib/dte';
import { formatCuit, formatRelative } from '../lib/format';
import { Icon } from './Icon';
import { Button, ButtonLink, Card, ConfirmDialog, Pill, StatusPill } from './ui';
import { DelegationGuide } from './DelegationGuide';
import type {
  DteIntegration,
  DteListItem,
  Paginated,
  Producer,
  SenasaDelegation,
} from '../lib/types';

/**
 * Piezas del panel traídas del prototipo ApiAsistente: el panel arranca por
 * lo que la persona vino a hacer (emitir o cerrar un DT-e), avisa si dejó
 * algo a medio armar, muestra lo que está en ruta y la ficha del titular.
 */

/* =========================================================================
   Encabezado con la acción principal
   ========================================================================= */

/**
 * El primer bloque del panel. Para quien emite, la pregunta es si sale una
 * carga; para la sala, si llegó una. La acción va grande y sola: es la razón
 * por la que se abre la app nueve de cada diez veces.
 */
export const Hero = ({
  firstName,
  kind,
  pending = 0,
  blocked,
}: {
  firstName: string;
  kind: 'issuer' | 'receiver';
  /** DT-e por cerrar (sala). */
  pending?: number;
  /** El titular tiene DT-e caducados y SIGSA no le deja emitir. */
  blocked?: boolean;
}) => (
  <section className="hero" aria-labelledby="hero-title">
    <div className="hero-text">
      <h1 id="hero-title">{firstName ? `Hola, ${firstName}` : 'Hola'}</h1>
      <p className="hero-sub">
        {kind === 'issuer'
          ? blocked
            ? 'Tenés DT-e caducados: podés armar borradores, pero SIGSA no deja emitir hasta regularizar.'
            : '¿Sale una carga para la sala? El DT-e se arma en cuatro pasos, con o sin señal.'
          : pending > 0
            ? `Hay ${pending === 1 ? 'un DT-e' : `${pending} DT-e`} para cerrar. Al descargar, pedí el código impreso y contá las alzas.`
            : '¿Llegó una carga? Cerrá el DT-e con el código impreso y las alzas que contaste.'}
      </p>
    </div>
    <div className="hero-actions">
      {kind === 'issuer' ? (
        <Link to="/dte?nuevo=1" className="btn btn-hero">
          <Icon name="plus" size={20} strokeWidth={2.4} />
          Nuevo DT-e
        </Link>
      ) : (
        <Link to="/dte?perspective=recibidos" className="btn btn-hero">
          <Icon name="inbox" size={20} />
          {pending > 0 ? `Cerrar DT-e (${pending})` : 'Ver DT-e recibidos'}
        </Link>
      )}
      <Link to="/trace" className="btn btn-hero-ghost">
        <Icon name="trace" size={18} />
        Consultar trazabilidad
      </Link>
    </div>
  </section>
);

/* =========================================================================
   DT-e a medio armar
   ========================================================================= */

export const DraftBanner = ({ onResume }: { onResume?: () => void }) => {
  const { user, canWrite } = useAuth();
  const navigate = useNavigate();
  const { draft, discard } = useDteDraft(user?.id);
  const [confirming, setConfirming] = useState(false);

  if (!draft || !canWrite) return null;

  const values = draft.values;
  const facts = [
    values.declaredQuantity ? `${values.declaredQuantity} alzas` : null,
    draft.context ? `reemplazo para ${draft.context.movementCode}` : null,
  ].filter(Boolean);

  return (
    <div className="draft-banner" role="status">
      <span className="draft-icon" aria-hidden="true">
        <Icon name="document" size={20} />
      </span>
      <div className="grow">
        <div className="draft-title">Tenés un DT-e a medio armar</div>
        <div className="small muted">
          Quedó en {DRAFT_STEP_NAMES[draft.step] ?? 'el asistente'}
          {facts.length > 0 ? `, ${facts.join(', ')}` : ''}. Guardado {formatRelative(draft.savedAt)}.
        </div>
      </div>
      <div className="draft-actions">
        <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
          Descartar
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon="play"
          onClick={() => (onResume ? onResume() : navigate('/dte?nuevo=1'))}
        >
          Continuar
        </Button>
      </div>
      {confirming && (
        <ConfirmDialog
          title="¿Descartar el DT-e a medio armar?"
          description="Se borra lo que cargaste en este dispositivo. No cambia ningún DT-e ya guardado."
          confirmLabel="Descartar"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            void discard();
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   En ruta
   ========================================================================= */

/**
 * Los DT-e que hoy amparan un viaje. Reemplaza a la «tarjeta de tránsito»
 * con GPS simulado del prototipo: acá la barra mide la vigencia real, del día
 * de carga a las 23:59 del vencimiento, que es lo que fija la norma.
 */
export const OnRouteCard = ({ perspective }: { perspective: 'emitidos' | 'recibidos' }) => {
  const list = useResource<Paginated<DteListItem>>(
    `/dte?perspective=${perspective}&status=VIGENTE&pageSize=3`,
  );
  const items = list.data?.data ?? [];
  if (items.length === 0) return null;

  return (
    <Card
      title={perspective === 'emitidos' ? 'En ruta ahora' : 'Llegan a tu sala'}
      actions={
        <ButtonLink to={`/dte?perspective=${perspective}&status=VIGENTE`} size="sm">
          Ver todos
        </ButtonLink>
      }
      flush
    >
      <ul className="route-list">
        {items.map((item) => {
          const window = validityWindow(item.loadDate, item.expiryDate);
          const percent = Math.round((window?.progress ?? 0) * 100);
          return (
            <li key={item.id}>
              <Link to={`/dte/${item.id}`} className="route-item">
                <span className="route-item-top">
                  <strong className="mono">{item.number ?? 'Sin número'}</strong>
                  {window && (
                    <span className={`pill pill-${window.tone === 'neutral' ? 'info' : window.tone}`}>
                      <Icon name="clock" size={13} />
                      {window.label}
                    </span>
                  )}
                </span>
                <span className="route-item-path">
                  <span>{item.apiaryName ?? item.apiaryCode ?? item.originName}</span>
                  <span aria-hidden="true" className="faint">
                    →
                  </span>
                  <span className="sr-only">hacia</span>
                  <span>{item.destinationName}</span>
                </span>
                <span
                  className={`validity validity-${window?.tone ?? 'neutral'}`}
                  role="progressbar"
                  aria-label="Vigencia transcurrida"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span style={{ width: `${percent}%` }} />
                </span>
                <span className="xs muted">
                  {item.declaredQuantity ?? '—'} alzas declaradas.{' '}
                  {perspective === 'emitidos'
                    ? 'Llevá el DT-e impreso en la cabina.'
                    : 'Al llegar, pedí el código de cierre impreso.'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};

/* =========================================================================
   Ficha del titular
   ========================================================================= */

/**
 * La «tarjeta del productor» de ApiAsistente: quién emite, con qué RENAPA,
 * si puede emitir y si delegó SIGSA. Es lo que hay que tener en regla antes
 * de cargar el primer DT-e, a la vista y no escondido en Productores.
 */
export const HolderCard = ({
  blockedIds,
  integration,
}: {
  blockedIds: string[];
  integration: DteIntegration | null | undefined;
}) => {
  const [guide, setGuide] = useState(false);
  const closeGuide = useCallback(() => setGuide(false), []);
  const producers = useResource<Paginated<Producer>>('/producers?pageSize=1');
  const producer = producers.data?.data[0];
  const detail = useResource<Producer>(producer ? `/producers/${producer.id}` : null);
  const delegations = useResource<SenasaDelegation[]>(
    producer ? `/producers/${producer.id}/senasa-delegations` : null,
  );

  if (!producer) return null;

  const renapa =
    detail.data?.renapa?.find((item) => item.status === 'ACTIVE') ?? detail.data?.renapa?.[0];
  const sigsa = delegations.data?.find((item) => item.service === 'SIGSA_DTE');
  const blocked = blockedIds.includes(producer.id);
  const delegated = sigsa?.status === 'ACEPTADA';

  return (
    <Card
      title="Tu ficha de titular"
      help="producers"
      actions={
        <ButtonLink to="/producers" size="sm">
          Ver datos
        </ButtonLink>
      }
    >
      <div className="holder">
        <div className="holder-who">
          <span className="holder-avatar" aria-hidden="true">
            <Icon name="idCard" size={20} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="holder-name">{producer.businessName}</div>
            <div className="small muted">CUIT {formatCuit(producer.taxId)}</div>
          </div>
        </div>
        <dl className="holder-rows">
          <div>
            <dt>RENAPA</dt>
            <dd>
              {renapa ? (
                <>
                  <span className="mono">{renapa.number}</span>
                  <StatusPill status={renapa.status} />
                </>
              ) : detail.loading ? (
                <span className="muted">Consultando…</span>
              ) : (
                <Pill tone="warning" icon="warning">
                  Sin cargar
                </Pill>
              )}
            </dd>
          </div>
          <div>
            <dt>Emisión de DT-e</dt>
            <dd>
              {blocked ? (
                <Pill tone="danger" icon="danger">
                  Bloqueada: DT-e caducados
                </Pill>
              ) : (
                <Pill tone="success" icon="checkCircle">
                  Sin bloqueos
                </Pill>
              )}
            </dd>
          </div>
          <div>
            <dt>Delegación SIGSA</dt>
            <dd>
              <StatusPill status={sigsa?.status ?? 'NO_INICIADA'} />
            </dd>
          </div>
        </dl>
        {!delegated && (
          <div className="holder-foot">
            <p className="small muted">
              {integration?.mode === 'sigsa'
                ? 'Para que ApiTrace pida tus DT-e a SIGSA, delegá el servicio en ARCA. Se hace una sola vez.'
                : 'Hace falta cuando ApiTrace pida los DT-e a SIGSA por API. Mientras tanto, los emitís en SIGSA y los registrás acá.'}
            </p>
            <Button size="sm" icon="shield" onClick={() => setGuide(true)}>
              Cómo delegar en ARCA
            </Button>
          </div>
        )}
      </div>
      {guide && <DelegationGuide onClose={closeGuide} />}
    </Card>
  );
};
