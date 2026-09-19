import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'apitrace.theme';

/**
 * Claro por defecto, a proposito.
 *
 * La aplicacion se usa en el campo, a pleno sol, donde un fondo oscuro se ve
 * peor. El tema oscuro queda disponible para el trabajo de escritorio y para
 * quien lo prefiera, pero se elige: no se hereda del sistema operativo, porque
 * un telefono en modo oscuro automatico dejaba la app ilegible en el apiario
 * sin que su dueno entendiera por que.
 */
const DEFAULT_THEME: Theme = 'light';

/** Color de la barra del navegador y de la aplicacion instalada, por tema. */
const BROWSER_CHROME: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#1a1410',
};

const readStored = (): Theme => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'dark' || raw === 'light' ? raw : DEFAULT_THEME;
  } catch {
    // Modo privado o almacenamiento bloqueado: se usa el valor por defecto.
    return DEFAULT_THEME;
  }
};

export const applyTheme = (theme: Theme): void => {
  document.documentElement.dataset.theme = theme;
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute('content', BROWSER_CHROME[theme]));
};

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(readStored);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // La eleccion vale para esta sesion aunque no se pueda guardar.
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggle = useCallback(
    () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggle }),
    [theme, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme debe usarse dentro de ThemeProvider.');
  return context;
};
