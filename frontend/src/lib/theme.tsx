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
 * Hasta el rediseño, el tema por defecto (claro) se guardaba como si fuera una
 * elección. Esta marca distingue lo elegido después del cambio: quien todavía
 * no la tiene pasa una vez al oscuro, que es ahora el modo principal.
 */
const CHOICE_KEY = 'apitrace.theme.v2';

/**
 * Oscuro por defecto desde el rediseño (doc 13).
 *
 * Las pantallas nuevas se diseñaron en oscuro carbón con acento ámbar, y es
 * el modo principal. El claro queda a un toque en Configuración para quien
 * trabaja a pleno sol. Ninguno se hereda del sistema operativo: la elección es
 * de la persona y se recuerda en el dispositivo.
 */
const DEFAULT_THEME: Theme = 'dark';

/** Color de la barra del navegador y de la aplicacion instalada, por tema. */
const BROWSER_CHROME: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#1a1b20',
};

const readStored = (): Theme => {
  try {
    if (localStorage.getItem(CHOICE_KEY) !== '1') return DEFAULT_THEME;
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
      localStorage.setItem(CHOICE_KEY, '1');
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
