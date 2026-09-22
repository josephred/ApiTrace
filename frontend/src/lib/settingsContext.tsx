import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/**
 * Preferencias que se guardan en este dispositivo.
 *
 * Solo se guarda lo que la aplicación usa de verdad: una preferencia que no
 * cambia nada confunde más de lo que ayuda. Las reglas del DT-e (vigencia,
 * gracia, canal de emisión) no son preferencias: las fija la norma y el
 * servidor, y la pantalla de Configuración las muestra de solo lectura.
 */
export interface DevicePreferences {
  /** Patente habitual del vehículo (chasis). Precarga el paso «Transporte» del DT-e. */
  vehiclePlate: string;
  /** Patente habitual del acoplado, si lo hay. */
  trailerPlate: string;
}

const DEFAULT_PREFERENCES: DevicePreferences = {
  vehiclePlate: '',
  trailerPlate: '',
};

const STORAGE_KEY = 'apitrace.preferencias';
/** Clave de la versión anterior de esta pantalla; se lee una vez para no perder patentes. */
const LEGACY_KEY = 'apitrace.role_settings';
/** Valores de ejemplo que la versión anterior guardaba por defecto: no son datos del usuario. */
const LEGACY_PLACEHOLDERS = new Set(['AF-123-CD', 'AD-456-EF']);

const clean = (value: unknown): string =>
  typeof value === 'string' && !LEGACY_PLACEHOLDERS.has(value.trim()) ? value.trim() : '';

const readStored = (): DevicePreferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<DevicePreferences>) };
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Record<string, Record<string, unknown> | undefined>;
      const source = parsed.productor ?? parsed.transportista ?? {};
      return {
        vehiclePlate: clean(source.defaultPlateVehicle),
        trailerPlate: clean(source.defaultPlateTrailer),
      };
    }
  } catch {
    // Almacenamiento bloqueado o dato corrupto: se usan los valores vacíos.
  }
  return DEFAULT_PREFERENCES;
};

interface PreferencesContextValue {
  preferences: DevicePreferences;
  updatePreferences: (updates: Partial<DevicePreferences>) => void;
  resetPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const persist = (value: DevicePreferences) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Sin almacenamiento la preferencia dura hasta cerrar la pestaña.
  }
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [preferences, setPreferences] = useState<DevicePreferences>(readStored);

  const updatePreferences = useCallback((updates: Partial<DevicePreferences>) => {
    setPreferences((previous) => {
      const next = { ...previous, ...updates };
      persist(next);
      return next;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    persist(DEFAULT_PREFERENCES);
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences, resetPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = (): PreferencesContextValue => {
  const context = useContext(PreferencesContext);
  if (!context) {
    return {
      preferences: DEFAULT_PREFERENCES,
      updatePreferences: () => {},
      resetPreferences: () => {},
    };
  }
  return context;
};
