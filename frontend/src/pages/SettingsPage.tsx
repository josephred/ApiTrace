import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { useHelpSettings } from '../lib/helpContext';
import { usePreferences } from '../lib/settingsContext';
import { useSync } from '../lib/sync';
import { useResource } from '../lib/useResource';
import { formatRelative } from '../lib/format';
import { normalizePlate } from '../lib/dte';
import { INTEGRATION_MODES, roleLabel } from '../lib/vocabulary';
import { Icon } from '../components/Icon';
import {
  Button,
  Card,
  HelpTip,
  Notice,
  PageHeader,
  SummaryList,
  useWriteFeedback,
} from '../components/ui';
import type { DteIntegration, UserRole } from '../lib/types';

/** Roles que trabajan con DT-e (la misma lista que App.tsx). */
const DTE_ROLES: UserRole[] = ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'AUDITOR'];
/** Roles que cargan el transporte de un traslado. */
const VEHICLE_ROLES: UserRole[] = ['ADMIN', 'PRODUCTOR', 'TRANSPORTISTA'];

export const SettingsPage = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { helpEnabled, setHelpEnabled } = useHelpSettings();
  const { preferences, updatePreferences, resetPreferences } = usePreferences();
  const { online, syncing, pendingCount, flush, lastSyncAt } = useSync();
  const feedback = useWriteFeedback();

  const worksWithDte = Boolean(user && DTE_ROLES.includes(user.role));
  const loadsVehicles = Boolean(user && VEHICLE_ROLES.includes(user.role));
  const integration = useResource<DteIntegration>(worksWithDte ? '/dte/integration' : null);

  const [vehiclePlate, setVehiclePlate] = useState(preferences.vehiclePlate);
  const [trailerPlate, setTrailerPlate] = useState(preferences.trailerPlate);

  if (!user) return null;

  const savePreferences = (event: FormEvent) => {
    event.preventDefault();
    updatePreferences({
      vehiclePlate: normalizePlate(vehiclePlate),
      trailerPlate: normalizePlate(trailerPlate),
    });
    feedback.saved('Preferencias guardadas', 'Se usan en este dispositivo al preparar un DT-e.');
  };

  return (
    <div className="stack" style={{ gap: 'var(--sp-6)' }}>
      <PageHeader
        title="Configuración"
        sub="Preferencias de este dispositivo y el canal de emisión de DT-e que usa el sistema."
        help="settings"
        actions={
          <div className="row row-tight">
            <span className="pill pill-brand font-medium">
              Rol activo: {roleLabel(user.role)}
            </span>
          </div>
        }
      />

      {/* =====================================================================
          SECCIÓN 1: INTERFAZ Y EXPERIENCIA (TODOS LOS USUARIOS)
          ===================================================================== */}
      <div>
        <div className="form-section-title" style={{ marginBottom: 'var(--sp-3)' }}>
          Preferencias de visualización e interfaz
        </div>
        <div className="grid c2" style={{ gap: 'var(--sp-4)' }}>
          {/* Tarjeta de Tema */}
          <Card title="Tema visual de la aplicación">
            <div className="stack" style={{ gap: 'var(--sp-3)' }}>
              <p className="small muted" style={{ margin: 0 }}>
                Elegí el esquema de contraste adecuado para tu entorno de trabajo.
              </p>
              <div className="settings-options-grid">
                <button
                  type="button"
                  className={`settings-option-card ${theme === 'light' ? 'selected' : ''}`}
                  onClick={() => setTheme('light')}
                  aria-pressed={theme === 'light'}
                >
                  <div className="row-between">
                    <div className="row row-tight">
                      <Icon name="sun" size={20} />
                      <strong>Modo Claro</strong>
                    </div>
                    {theme === 'light' && <span className="badge-active">Activo</span>}
                  </div>
                  <span className="xs muted">
                    Fondo claro de alto contraste. Recomendado para uso en campo bajo sol directo.
                  </span>
                </button>

                <button
                  type="button"
                  className={`settings-option-card ${theme === 'dark' ? 'selected' : ''}`}
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                >
                  <div className="row-between">
                    <div className="row row-tight">
                      <Icon name="moon" size={20} />
                      <strong>Modo Oscuro</strong>
                    </div>
                    {theme === 'dark' && <span className="badge-active">Activo</span>}
                  </div>
                  <span className="xs muted">
                    Superficie relajante para ambientes con poca luz, salas y oficinas.
                  </span>
                </button>
              </div>
            </div>
          </Card>

          {/* Tarjeta de Ayuda Contextual */}
          <Card title="Ayuda contextual interactiva">
            <div className="stack" style={{ gap: 'var(--sp-3)' }}>
              <p className="small muted" style={{ margin: 0 }}>
                Controlá si querés ver los botones de ayuda (?) con definiciones, ejemplos y normativa en cada pantalla.
              </p>
              <div className="settings-options-grid">
                <button
                  type="button"
                  className={`settings-option-card ${helpEnabled ? 'selected' : ''}`}
                  onClick={() => setHelpEnabled(true)}
                  aria-pressed={helpEnabled}
                >
                  <div className="row-between">
                    <div className="row row-tight">
                      <Icon name="sparkles" size={20} />
                      <strong>Con ayuda guiada</strong>
                    </div>
                    {helpEnabled && <span className="badge-active">Activo</span>}
                  </div>
                  <span className="xs muted">
                    Muestra insignias y explicaciones con ejemplos de uso y resoluciones oficiales.
                  </span>
                </button>

                <button
                  type="button"
                  className={`settings-option-card ${!helpEnabled ? 'selected' : ''}`}
                  onClick={() => setHelpEnabled(false)}
                  aria-pressed={!helpEnabled}
                >
                  <div className="row-between">
                    <div className="row row-tight">
                      <Icon name="close" size={20} />
                      <strong>Modo experto</strong>
                    </div>
                    {!helpEnabled && <span className="badge-active">Activo</span>}
                  </div>
                  <span className="xs muted">
                    Oculta las burbujas para una interfaz minimalista, limpia y sin interrupciones.
                  </span>
                </button>
              </div>

              {/* Previsualización en vivo */}
              <div
                style={{
                  padding: 'var(--sp-3)',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--sp-2)',
                }}
              >
                <div className="small">
                  <span>Prueba en vivo: </span>
                  <strong>Por enviar</strong>
                </div>
                <div>
                  {helpEnabled ? (
                    <HelpTip topic="pending" />
                  ) : (
                    <span className="xs faint">(Ayuda oculta)</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* =====================================================================
          SECCIÓN 2: DISPOSITIVO Y RESILIENCIA OFFLINE (TODOS)
          ===================================================================== */}
      <div>
        <div className="form-section-title" style={{ marginBottom: 'var(--sp-3)' }}>
          Estado del dispositivo y almacenamiento local
        </div>
        <Card>
          <div className="grid c3" style={{ gap: 'var(--sp-4)', alignItems: 'center' }}>
            <div>
              <div className="xs muted" style={{ fontWeight: 600 }}>CONECTIVIDAD</div>
              <div className="row row-tight" style={{ marginTop: 'var(--sp-1)' }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: online ? '#16a34a' : '#ea580c',
                  }}
                />
                <strong>{online ? 'Conectado a la red' : 'Sin conexión a internet'}</strong>
              </div>
              <div className="xs faint" style={{ marginTop: 2 }}>
                {online ? 'Sincronización en tiempo real habilitada' : 'Trabajando en almacenamiento local'}
              </div>
            </div>

            <div>
              <div className="xs muted" style={{ fontWeight: 600 }}>BASE DE DATOS LOCAL</div>
              <div style={{ marginTop: 'var(--sp-1)' }}>
                <strong>IndexedDB (apitrace.db)</strong>
              </div>
              <div className="xs faint" style={{ marginTop: 2 }}>
                {pendingCount === 0
                  ? `Todo sincronizado · al día ${formatRelative(lastSyncAt)}`
                  : `${pendingCount} operación(es) pendiente(s) en cola`}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant={pendingCount > 0 ? 'primary' : 'secondary'}
                size="sm"
                icon="sync"
                busy={syncing}
                busyLabel="Sincronizando…"
                onClick={() => void flush()}
                disabled={!online}
              >
                Sincronizar ahora
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* =====================================================================
          SECCIÓN 3: CANAL DE EMISIÓN DE DT-e (SOLO LECTURA)
          ===================================================================== */}
      {worksWithDte && (
        <div>
          <div className="form-section-title" style={{ marginBottom: 'var(--sp-3)' }}>
            Emisión de DT-e
          </div>
          <Card title="Canal de emisión" help="dteModes">
            {integration.data ? (
              <div className="stack" style={{ gap: 'var(--sp-3)' }}>
                {integration.data.mode === 'simulado' && (
                  <Notice tone="warning" title="Modo simulado">
                    Los DT-e que se «emiten» en este modo no tienen validez oficial: sirven para
                    practicar. No se debe transitar con ellos.
                  </Notice>
                )}
                <SummaryList
                  rows={[
                    { key: 'Canal', value: INTEGRATION_MODES.label(integration.data.mode) },
                    { key: 'Detalle', value: integration.data.description },
                    {
                      key: 'Vencimiento',
                      value: `${integration.data.rules.defaultValidityDays} días después de la carga por defecto; hasta ${integration.data.rules.maxValidityDays}`,
                    },
                    {
                      key: 'Anticipación',
                      value: `Hasta ${integration.data.rules.maxAnticipationDays} días antes de la carga`,
                    },
                    {
                      key: 'Gracia sin cierre',
                      value: `${integration.data.rules.graceDays} días después del vencimiento; después caduca`,
                    },
                  ]}
                />
                <p className="small muted" style={{ margin: 0 }}>
                  El canal lo define quien opera el servidor (variable <span className="mono">SENASA_MODE</span>)
                  y las reglas vienen de la norma: no se cambian desde esta pantalla.
                </p>
              </div>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>
                {integration.loading ? 'Consultando…' : 'No se pudo consultar el canal de emisión.'}
              </p>
            )}
          </Card>
        </div>
      )}

      {/* =====================================================================
          SECCIÓN 4: VEHÍCULO HABITUAL (PRECARGA DEL DT-e)
          ===================================================================== */}
      {loadsVehicles && (
        <div>
          <div className="form-section-title" style={{ marginBottom: 'var(--sp-3)' }}>
            Vehículo habitual
          </div>
          <Card>
            <form onSubmit={savePreferences} className="stack" style={{ gap: 'var(--sp-4)' }}>
              <p className="small muted" style={{ margin: 0 }}>
                Se guarda en este dispositivo y precarga el paso «Transporte» al preparar un DT-e.
                Siempre podés cambiarla en el momento.
              </p>
              <div className="grid c2" style={{ gap: 'var(--sp-4)' }}>
                <div className="field">
                  <label className="field-label" htmlFor="pref-plate">
                    Patente del vehículo
                  </label>
                  <input
                    id="pref-plate"
                    type="text"
                    placeholder="AA123BC"
                    autoComplete="off"
                    value={vehiclePlate}
                    onChange={(event) => setVehiclePlate(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="pref-trailer">
                    Patente del acoplado
                  </label>
                  <input
                    id="pref-trailer"
                    type="text"
                    placeholder="Si lleva acoplado"
                    autoComplete="off"
                    value={trailerPlate}
                    onChange={(event) => setTrailerPlate(event.target.value)}
                  />
                </div>
              </div>
              <div
                className="row row-between"
                style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-4)' }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetPreferences();
                    setVehiclePlate('');
                    setTrailerPlate('');
                    feedback.saved('Preferencias borradas', 'Este dispositivo ya no precarga patentes.');
                  }}
                >
                  Borrar
                </Button>
                <Button type="submit" variant="primary" icon="check">
                  Guardar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
