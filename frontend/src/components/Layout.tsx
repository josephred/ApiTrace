import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useSync } from '../lib/sync';
import { formatRelative } from '../lib/format';
import { itemLabel, navFor, quickNavFor, type NavItem } from '../lib/nav';
import { roleLabel } from '../lib/vocabulary';
import { Icon, Logo } from './Icon';
import { Button, HelpTip, Sheet } from './ui';
import { InstallPrompt } from './InstallPrompt';

/* =========================================================================
   Estado de los datos — un solo lugar
   ========================================================================= */

/**
 * Antes el estado de conexión se repetia en tres sitios (barra, insignia del
 * encabezado y contador del menu) y aun así no quedaba claro que pasaba con lo
 * registrado. Aca hay cuatro situaciones y una sola barra, y solo la última
 * interrumpe, porque es la única que necesita a una persona.
 */
const SyncBar = () => {
  const { online, syncing, pendingCount, failedCount, flush } = useSync();
  const navigate = useNavigate();

  if (failedCount > 0) {
    return (
      <div className="statusbar statusbar-failed">
        <Icon name="danger" size={16} />
        <span>
          {failedCount === 1
            ? '1 operación necesita tu revisión'
            : `${failedCount} operaciones necesitan tu revisión`}
        </span>
        <Button size="sm" variant="ghost" onClick={() => navigate('/pending')}>
          Revisar
        </Button>
      </div>
    );
  }

  if (!online) {
    return (
      <div className="statusbar statusbar-offline">
        <Icon name="offline" size={16} />
        <span>Sin conexión. Podés seguir trabajando.</span>
        <HelpTip topic="offline" />
      </div>
    );
  }

  if (syncing) {
    return (
      <div className="statusbar statusbar-syncing">
        <span className="spinner" aria-hidden="true" />
        <span>Enviando lo que quedó pendiente…</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="statusbar statusbar-syncing">
        <Icon name="sync" size={16} />
        <span>
          {pendingCount === 1 ? '1 operación por enviar' : `${pendingCount} operaciones por enviar`}
        </span>
        <Button size="sm" variant="ghost" onClick={() => void flush()}>
          Enviar ahora
        </Button>
      </div>
    );
  }

  return null;
};

/* =========================================================================
   Datos de la sesión
   ========================================================================= */

const initials = (fullName: string): string =>
  fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const AccountBlock = ({ onLogout }: { onLogout: () => void }) => {
  const { user } = useAuth();
  const { lastSyncAt } = useSync();
  if (!user) return null;

  return (
    <div className="sidebar-footer">
      <span className="avatar" aria-hidden="true">
        {initials(user.fullName)}
      </span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="small truncate" style={{ fontWeight: 650 }}>
          {user.fullName}
        </div>
        <div className="xs faint truncate">
          {roleLabel(user.role)} · al día {formatRelative(lastSyncAt)}
        </div>
      </div>
      <Button variant="ghost" className="btn-icon" onClick={onLogout} aria-label="Cerrar sesión">
        <Icon name="logout" size={18} />
      </Button>
    </div>
  );
};

/* =========================================================================
   Composicion
   ========================================================================= */

export const Layout = () => {
  const { user, logout } = useAuth();
  const { pendingCount, failedCount } = useSync();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  const groups = navFor(user.role);
  const quick = quickNavFor(user.role);
  const quickPaths = new Set(quick.map((item) => item.to));
  const rest = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !quickPaths.has(item.to)) }))
    .filter((group) => group.items.length > 0);

  const queueCount = pendingCount + failedCount;
  const renderNavLink = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
    >
      <Icon name={item.icon} size={18} />
      <span className="nav-text">{itemLabel(item, user.role)}</span>
      {item.to === '/pending' && queueCount > 0 && (
        <span className={failedCount > 0 ? 'pill pill-danger' : 'pill pill-warning'}>
          {queueCount}
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="app">
      {/* --------------------------------------------- escritorio: lateral */}
      <aside className="sidebar">
        <div className="brand">
          <Logo size={28} />
          <span>ApiTrace</span>
        </div>
        <nav className="nav" aria-label="Secciones">
          {groups.map((group) => (
            <div className="nav-group" key={group.group}>
              <div className="nav-group-label">{group.group}</div>
              {group.items.map(renderNavLink)}
            </div>
          ))}
          <div style={{ padding: 'var(--sp-3) var(--sp-3) 0' }}>
            <InstallPrompt />
          </div>
        </nav>
        <AccountBlock onLogout={() => void handleLogout()} />
      </aside>

      <div className="main">
        <SyncBar />

        {/*
          En el telefono no hay barra superior: el titulo ya lo da el encabezado
          de cada pagina y la barra inferior dice donde esta el usuario. Quitarla
          devuelve 56 px de alto util en cada pantalla, que en un movil valen mas
          que repetir el nombre de la seccion dos veces.
        */}
        <main className="content" id="contenido">
          <Outlet />
        </main>
      </div>

      {/* ------------------------------------------------ movil: pestanas */}
      <nav className="tabbar" aria-label="Navegacion principal">
        {quick.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
          >
            <Icon name={item.icon} size={21} />
            <span className="tab-label">{itemLabel(item, user.role)}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={moreOpen ? 'tab active' : 'tab'}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <Icon name="more" size={21} />
          <span className="tab-label">Más</span>
          {!quickPaths.has('/pending') && queueCount > 0 && (
            <span className="tab-badge" aria-hidden="true">
              {queueCount}
            </span>
          )}
        </button>
      </nav>

      {moreOpen && (
        <Sheet title="Todas las secciones" onClose={() => setMoreOpen(false)}>
          <nav aria-label="Más secciones">
            {rest.map((group) => (
              <div className="nav-group" key={group.group} style={{ marginBottom: 'var(--sp-4)' }}>
                <div className="nav-group-label">{group.group}</div>
                {group.items.map(renderNavLink)}
              </div>
            ))}
          </nav>
          <div
            style={{
              borderTop: '1px solid var(--border)',
              marginTop: 'var(--sp-2)',
              paddingTop: 'var(--sp-4)',
            }}
          >
            <div className="row-between">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 650 }} className="truncate">
                  {user.fullName}
                </div>
                <div className="small faint">{roleLabel(user.role)}</div>
              </div>
              <div className="row row-tight">
                <InstallPrompt />
                <Button variant="secondary" icon="logout" onClick={() => void handleLogout()}>
                  Salir
                </Button>
              </div>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
};
