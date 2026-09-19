import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { UserRole } from './types';

export interface AdminRoleSettings {
  senasaDefaultMode: 'SIGSA' | 'MANUAL' | 'SIMULADO';
  overestimateMelariosPercent: number;
  strictPreflightValidation: boolean;
  autoRefreshMinutes: number;
}

export interface ProducerRoleSettings {
  defaultRenapaNumber: string;
  defaultPlateVehicle: string;
  defaultPlateTrailer: string;
  notifyDteExpiryHours: number;
}

export interface SalaRoleSettings {
  defaultDrumTareKg: number;
  minYieldKgPerMelario: number;
  maxYieldKgPerMelario: number;
  requireVerificationCodeOnClose: boolean;
}

export interface AcopiadorRoleSettings {
  maxMoisturePercent: number;
  preferredLotUnit: 'KG' | 'TAMBOR';
  alertOnDiscrepancyPercent: number;
}

export interface TransportistaRoleSettings {
  defaultPlateVehicle: string;
  defaultPlateTrailer: string;
  highContrastSemaphore: boolean;
}

export interface AuditorRoleSettings {
  maxMoistureAlert: number;
  maxHmfMgKg: number;
  defaultExportFormat: 'PDF' | 'CSV' | 'JSON';
  showTechnicalCodes: boolean;
}

export interface SystemSettingsState {
  admin: AdminRoleSettings;
  productor: ProducerRoleSettings;
  sala: SalaRoleSettings;
  acopiador: AcopiadorRoleSettings;
  transportista: TransportistaRoleSettings;
  auditor: AuditorRoleSettings;
}

const DEFAULT_SETTINGS: SystemSettingsState = {
  admin: {
    senasaDefaultMode: 'SIGSA',
    overestimateMelariosPercent: 15,
    strictPreflightValidation: true,
    autoRefreshMinutes: 5,
  },
  productor: {
    defaultRenapaNumber: 'BA-09241',
    defaultPlateVehicle: 'AF-123-CD',
    defaultPlateTrailer: 'AD-456-EF',
    notifyDteExpiryHours: 24,
  },
  sala: {
    defaultDrumTareKg: 18.5,
    minYieldKgPerMelario: 15,
    maxYieldKgPerMelario: 32,
    requireVerificationCodeOnClose: true,
  },
  acopiador: {
    maxMoisturePercent: 18.0,
    preferredLotUnit: 'KG',
    alertOnDiscrepancyPercent: 1.0,
  },
  transportista: {
    defaultPlateVehicle: 'AF-123-CD',
    defaultPlateTrailer: 'AD-456-EF',
    highContrastSemaphore: false,
  },
  auditor: {
    maxMoistureAlert: 18.0,
    maxHmfMgKg: 40.0,
    defaultExportFormat: 'PDF',
    showTechnicalCodes: true,
  },
};

const STORAGE_KEY = 'apitrace.role_settings';

const readStoredSettings = (): SystemSettingsState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      admin: { ...DEFAULT_SETTINGS.admin, ...parsed.admin },
      productor: { ...DEFAULT_SETTINGS.productor, ...parsed.productor },
      sala: { ...DEFAULT_SETTINGS.sala, ...parsed.sala },
      acopiador: { ...DEFAULT_SETTINGS.acopiador, ...parsed.acopiador },
      transportista: { ...DEFAULT_SETTINGS.transportista, ...parsed.transportista },
      auditor: { ...DEFAULT_SETTINGS.auditor, ...parsed.auditor },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

interface SettingsContextValue {
  settings: SystemSettingsState;
  updateRoleSettings: <K extends keyof SystemSettingsState>(
    section: K,
    updates: Partial<SystemSettingsState[K]>,
  ) => void;
  resetRoleSettings: (section: keyof SystemSettingsState) => void;
  getRoleSettingsKey: (role: UserRole) => keyof SystemSettingsState;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SystemSettingsState>(readStoredSettings);

  const updateRoleSettings = useCallback(
    <K extends keyof SystemSettingsState>(
      section: K,
      updates: Partial<SystemSettingsState[K]>,
    ) => {
      setSettings((prev) => {
        const next = {
          ...prev,
          [section]: {
            ...prev[section],
            ...updates,
          },
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // LocalStorage no disponible
        }
        return next;
      });
    },
    [],
  );

  const resetRoleSettings = useCallback((section: keyof SystemSettingsState) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        [section]: DEFAULT_SETTINGS[section],
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignorar
      }
      return next;
    });
  }, []);

  const getRoleSettingsKey = useCallback((role: UserRole): keyof SystemSettingsState => {
    switch (role) {
      case 'ADMIN':
        return 'admin';
      case 'PRODUCTOR':
        return 'productor';
      case 'SALA':
        return 'sala';
      case 'ACOPIADOR':
      case 'FRACCIONADOR':
      case 'EXPORTADOR':
        return 'acopiador';
      case 'TRANSPORTISTA':
        return 'transportista';
      case 'AUDITOR':
      case 'LABORATORIO':
      case 'CONSULTA':
      default:
        return 'auditor';
    }
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, updateRoleSettings, resetRoleSettings, getRoleSettingsKey }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useRoleSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    return {
      settings: DEFAULT_SETTINGS,
      updateRoleSettings: () => {},
      resetRoleSettings: () => {},
      getRoleSettingsKey: () => 'admin',
    };
  }
  return ctx;
};
