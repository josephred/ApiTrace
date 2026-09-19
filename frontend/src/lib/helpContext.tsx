import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'apitrace.help_enabled';
const DEFAULT_HELP_ENABLED = true;

const readStored = (): boolean => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_HELP_ENABLED;
    return raw === 'true';
  } catch {
    return DEFAULT_HELP_ENABLED;
  }
};

interface HelpContextValue {
  helpEnabled: boolean;
  setHelpEnabled: (enabled: boolean) => void;
  toggleHelp: () => void;
}

const HelpContext = createContext<HelpContextValue | null>(null);

export const HelpProvider = ({ children }: { children: ReactNode }) => {
  const [helpEnabled, setHelpEnabledState] = useState<boolean>(readStored);

  const setHelpEnabled = useCallback((enabled: boolean) => {
    setHelpEnabledState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // Almacenamiento bloqueado o modo privado
    }
  }, []);

  const toggleHelp = useCallback(() => {
    setHelpEnabledState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Almacenamiento bloqueado
      }
      return next;
    });
  }, []);

  return (
    <HelpContext.Provider value={{ helpEnabled, setHelpEnabled, toggleHelp }}>
      {children}
    </HelpContext.Provider>
  );
};

export const useHelpSettings = (): HelpContextValue => {
  const ctx = useContext(HelpContext);
  if (!ctx) {
    return {
      helpEnabled: true,
      setHelpEnabled: () => {},
      toggleHelp: () => {},
    };
  }
  return ctx;
};
