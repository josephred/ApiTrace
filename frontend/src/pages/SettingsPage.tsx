import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { useHelpSettings } from '../lib/helpContext';
import { useRoleSettings } from '../lib/settingsContext';
import { useSync } from '../lib/sync';
import { formatRelative } from '../lib/format';
import { roleLabel } from '../lib/vocabulary';
import { Icon } from '../components/Icon';
import {
  Button,
  Card,
  HelpTip,
  Notice,
  PageHeader,
  useWriteFeedback,
} from '../components/ui';

export const SettingsPage = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { helpEnabled, setHelpEnabled } = useHelpSettings();
  const { settings, updateRoleSettings, resetRoleSettings, getRoleSettingsKey } = useRoleSettings();
  const { online, syncing, pendingCount, flush, lastSyncAt } = useSync();
  const feedback = useWriteFeedback();

  if (!user) return null;

  const roleKey = getRoleSettingsKey(user.role);

  // Estados locales temporales para formulario por rol
  const [adminMode, setAdminMode] = useState(settings.admin.senasaDefaultMode);
  const [overestimate, setOverestimate] = useState(settings.admin.overestimateMelariosPercent);
  const [strictPreflight, setStrictPreflight] = useState(settings.admin.strictPreflightValidation);

  const [renapa, setRenapa] = useState(settings.productor.defaultRenapaNumber);
  const [prodPlate, setProdPlate] = useState(settings.productor.defaultPlateVehicle);
  const [prodTrailer, setProdTrailer] = useState(settings.productor.defaultPlateTrailer);

  const [drumTare, setDrumTare] = useState(settings.sala.defaultDrumTareKg);
  const [minYield, setMinYield] = useState(settings.sala.minYieldKgPerMelario);
  const [requireVerifCode, setRequireVerifCode] = useState(settings.sala.requireVerificationCodeOnClose);

  const [maxMoisture, setMaxMoisture] = useState(settings.acopiador.maxMoisturePercent);
  const [lotUnit, setLotUnit] = useState(settings.acopiador.preferredLotUnit);

  const [transPlate, setTransPlate] = useState(settings.transportista.defaultPlateVehicle);
  const [transTrailer, setTransTrailer] = useState(settings.transportista.defaultPlateTrailer);

  const [exportFmt, setExportFmt] = useState(settings.auditor.defaultExportFormat);

  const handleSaveRoleSettings = (e: FormEvent) => {
    e.preventDefault();
    if (user.role === 'ADMIN') {
      updateRoleSettings('admin', {
        senasaDefaultMode: adminMode,
        overestimateMelariosPercent: Number(overestimate),
        strictPreflightValidation: strictPreflight,
      });
    } else if (user.role === 'PRODUCTOR') {
      updateRoleSettings('productor', {
        defaultRenapaNumber: renapa.trim(),
        defaultPlateVehicle: prodPlate.trim(),
        defaultPlateTrailer: prodTrailer.trim(),
      });
    } else if (user.role === 'SALA') {
      updateRoleSettings('sala', {
        defaultDrumTareKg: Number(drumTare),
        minYieldKgPerMelario: Number(minYield),
        requireVerificationCodeOnClose: requireVerifCode,
      });
    } else if (user.role === 'ACOPIADOR' || user.role === 'FRACCIONADOR' || user.role === 'EXPORTADOR') {
      updateRoleSettings('acopiador', {
        maxMoisturePercent: Number(maxMoisture),
        preferredLotUnit: lotUnit,
      });
    } else if (user.role === 'TRANSPORTISTA') {
      updateRoleSettings('transportista', {
        defaultPlateVehicle: transPlate.trim(),
        defaultPlateTrailer: transTrailer.trim(),
      });
    } else if (user.role === 'AUDITOR' || user.role === 'LABORATORIO') {
      updateRoleSettings('auditor', {
        defaultExportFormat: exportFmt,
      });
    }
    feedback.saved('Configuración guardada', 'Los parámetros fueron actualizados para tu sesión.');
  };

  return (
    <div className="stack" style={{ gap: 'var(--sp-6)' }}>
      <PageHeader
        title="Configuración del sistema"
        sub={`Preferencias de interfaz, almacenamiento y parámetros específicos para tu perfil de ${roleLabel(user.role)}.`}
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
          SECCIÓN 3: PARÁMETROS OPERATIVOS SEGÚN EL ROL
          ===================================================================== */}
      <div>
        <div className="form-section-title" style={{ marginBottom: 'var(--sp-3)' }}>
          Parámetros operativos para {roleLabel(user.role)}
        </div>

        <Card>
          <form onSubmit={handleSaveRoleSettings} className="stack" style={{ gap: 'var(--sp-4)' }}>
            {/* --------------------------- ADMIN --------------------------- */}
            {user.role === 'ADMIN' && (
              <>
                <Notice tone="info">
                  Como <strong>Administrador</strong>, estos parámetros afectan los valores por defecto del sistema
                  y los motores de validación previa (Preflight) ante SENASA / ARCA.
                </Notice>

                <div className="grid c2" style={{ gap: 'var(--sp-4)' }}>
                  <div className="field">
                    <label className="field-label" htmlFor="senasa-mode">
                      Modo de integración SENASA / API-SEM por defecto
                    </label>
                    <select
                      id="senasa-mode"
                      value={adminMode}
                      onChange={(e) => setAdminMode(e.target.value as any)}
                    >
                      <option value="SIGSA">Oficial (SENASA / SIGSA en línea)</option>
                      <option value="MANUAL">Carga manual de comprobante</option>
                      <option value="SIMULADO">Simulador para capacitación y pruebas</option>
                    </select>
                    <span className="field-hint">
                      Define qué adaptador se preselecciona al preparar un nuevo DT-e.
                    </span>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="overestimate">
                      Margen de sobreestimación en melarios cosechados (%)
                    </label>
                    <input
                      id="overestimate"
                      type="number"
                      min="0"
                      max="50"
                      value={overestimate}
                      onChange={(e) => setOverestimate(Number(e.target.value))}
                    />
                    <span className="field-hint">
                      Porcentaje técnico de holgura (+15% estándar SENASA) para evitar diferencias de carga.
                    </span>
                  </div>
                </div>

                <div className="field">
                  <label className="row row-tight" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={strictPreflight}
                      onChange={(e) => setStrictPreflight(e.target.checked)}
                    />
                    <span>
                      <strong>Exigir validación estricta en Preflight</strong> (frenar emisión si la patente o RENSPA no están activos)
                    </span>
                  </label>
                </div>
              </>
            )}

            {/* ------------------------- PRODUCTOR ------------------------- */}
            {user.role === 'PRODUCTOR' && (
              <>
                <Notice tone="info">
                  Parámetros para agilizar tus registros de traslados y mantener al día tus apiarios ante SENASA.
                </Notice>

                <div className="grid c2" style={{ gap: 'var(--sp-4)' }}>
                  <div className="field">
                    <label className="field-label" htmlFor="default-renapa">
                      Número de RENAPA habitual
                    </label>
                    <input
                      id="default-renapa"
                      type="text"
                      placeholder="Ej: BA-09241"
                      value={renapa}
                      onChange={(e) => setRenapa(e.target.value)}
                    />
                    <span className="field-hint">
                      Se utilizará para autocompletar tus solicitudes de DT-e y movimientos.
                    </span>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="prod-plate">
                      Patente de vehículo habitual (Chasis)
                    </label>
                    <input
                      id="prod-plate"
                      type="text"
                      placeholder="Ej: AF-123-CD"
                      value={prodPlate}
                      onChange={(e) => setProdPlate(e.target.value)}
                    />
                    <span className="field-hint">Formato oficial argentino (ej: AA-123-BB o AAA-123).</span>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="prod-trailer">
                      Patente de remolque / acoplado habitual
                    </label>
                    <input
                      id="prod-trailer"
                      type="text"
                      placeholder="Ej: AD-456-EF"
                      value={prodTrailer}
                      onChange={(e) => setProdTrailer(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* --------------------------- SALA ---------------------------- */}
            {user.role === 'SALA' && (
              <>
                <Notice tone="info">
                  Configuraciones de pesaje, tara de tambores y validación de cierre en sala de extracción.
                </Notice>

                <div className="grid c2" style={{ gap: 'var(--sp-4)' }}>
                  <div className="field">
                    <label className="field-label" htmlFor="drum-tare">
                      Tara estándar de tambores vacíos (kg)
                    </label>
                    <input
                      id="drum-tare"
                      type="number"
                      step="0.1"
                      value={drumTare}
                      onChange={(e) => setDrumTare(Number(e.target.value))}
                    />
                    <span className="field-hint">
                      Peso promedio del envase metálico con aro y tapa (habitual: 18.5 kg).
                    </span>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="min-yield">
                      Rendimiento mínimo de extracción esperado (kg / alza)
                    </label>
                    <input
                      id="min-yield"
                      type="number"
                      step="0.5"
                      value={minYield}
                      onChange={(e) => setMinYield(Number(e.target.value))}
                    />
                    <span className="field-hint">
                      El sistema advertirá si una extracción rinde menos de este valor.
                    </span>
                  </div>
                </div>

                <div className="field">
                  <label className="row row-tight" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={requireVerifCode}
                      onChange={(e) => setRequireVerifCode(e.target.checked)}
                    />
                    <span>
                      <strong>Exigir código de verificación de 12 dígitos</strong> para autorizar el cierre oficial del DT-e en sala
                    </span>
                  </label>
                </div>
              </>
            )}

            {/* ------------------ ACOPIADOR / FRACCIONADOR ----------------- */}
            {(user.role === 'ACOPIADOR' || user.role === 'FRACCIONADOR' || user.role === 'EXPORTADOR') && (
              <>
                <Notice tone="info">
                  Parámetros para acopio a granel, homogeneización y control de calidad bromatológica.
                </Notice>

                <div className="grid c2" style={{ gap: 'var(--sp-4)' }}>
                  <div className="field">
                    <label className="field-label" htmlFor="max-moisture">
                      Límite de alerta de humedad máxima (%)
                    </label>
                    <input
                      id="max-moisture"
                      type="number"
                      step="0.1"
                      value={maxMoisture}
                      onChange={(e) => setMaxMoisture(Number(e.target.value))}
                    />
                    <span className="field-hint">
                      Límite comercial y bromatológico (18.0% estándar para exportación).
                    </span>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="lot-unit">
                      Unidad de lote preferida
                    </label>
                    <select
                      id="lot-unit"
                      value={lotUnit}
                      onChange={(e) => setLotUnit(e.target.value as any)}
                    >
                      <option value="KG">Kilogramos (KG)</option>
                      <option value="TAMBOR">Tambores</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* ----------------------- TRANSPORTISTA ----------------------- */}
            {user.role === 'TRANSPORTISTA' && (
              <>
                <Notice tone="info">
                  Configuración de tu vehículo asignado y preferencias de pantalla para controles camineros en ruta.
                </Notice>

                <div className="grid c2" style={{ gap: 'var(--sp-4)' }}>
                  <div className="field">
                    <label className="field-label" htmlFor="trans-plate">
                      Patente de tu camión / chasis asignado
                    </label>
                    <input
                      id="trans-plate"
                      type="text"
                      placeholder="Ej: AF-123-CD"
                      value={transPlate}
                      onChange={(e) => setTransPlate(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="trans-trailer">
                      Patente de remolque o acoplado
                    </label>
                    <input
                      id="trans-trailer"
                      type="text"
                      placeholder="Ej: AD-456-EF"
                      value={transTrailer}
                      onChange={(e) => setTransTrailer(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* -------------------- AUDITOR / LABORATORIO ------------------ */}
            {(user.role === 'AUDITOR' || user.role === 'LABORATORIO') && (
              <>
                <Notice tone="info">
                  Parámetros de inspección de lotes, balance de masas y exportación de reportes de fiscalización.
                </Notice>

                <div className="grid c2" style={{ gap: 'var(--sp-4)' }}>
                  <div className="field">
                    <label className="field-label" htmlFor="export-fmt">
                      Formato de descarga de reportes de trazabilidad
                    </label>
                    <select
                      id="export-fmt"
                      value={exportFmt}
                      onChange={(e) => setExportFmt(e.target.value as any)}
                    >
                      <option value="PDF">Documento PDF oficial</option>
                      <option value="CSV">Planilla CSV de balance de masas</option>
                      <option value="JSON">Archivo JSON estructurado (Auditoría API)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div className="row row-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-4)', marginTop: 'var(--sp-2)' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetRoleSettings(roleKey);
                  feedback.saved('Valores restablecidos', 'Se volvieron a cargar los valores por defecto.');
                }}
              >
                Restablecer valores por defecto
              </Button>

              <Button type="submit" variant="primary" icon="check">
                Guardar configuración
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
