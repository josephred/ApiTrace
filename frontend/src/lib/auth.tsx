import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiLogin, apiLogout, configureAuthHooks, setTokens } from './api';
import { wipeLocalData } from './db';
import type { AuthTokens, AuthUser, UserRole } from './types';

const STORAGE_KEY = 'apitrace.session';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  canWrite: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const readStored = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
};

const writeStored = (session: StoredSession | null): void => {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Modo privado o almacenamiento lleno: la sesion vive solo en memoria.
  }
};

/**
 * La sesion se guarda en localStorage y no solo en memoria porque la aplicacion
 * debe poder reabrirse sin red: si el token viviera solo en memoria, recargar
 * la pagina en el campo dejaria al usuario sin acceso ni siquiera a lo cacheado.
 * El riesgo asumido es XSS; se compensa con tokens de acceso cortos (30 min) y
 * refresh rotativo del lado del servidor.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setTokens({ accessToken: stored.accessToken, refreshToken: stored.refreshToken });
      setUser(stored.user);
    }
    setReady(true);
  }, []);

  const logout = useCallback(async () => {
    const stored = readStored();
    if (stored?.refreshToken) await apiLogout(stored.refreshToken);
    setTokens(null);
    writeStored(null);
    setUser(null);
    // Se borra lo local para no dejar datos de un usuario visibles a otro.
    await wipeLocalData();
  }, []);

  useEffect(() => {
    configureAuthHooks({
      onTokensRefreshed: (next) => {
        const stored = readStored();
        if (!stored) return;
        writeStored({ ...stored, ...next });
      },
      onSessionExpired: () => {
        setTokens(null);
        writeStored(null);
        setUser(null);
      },
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin<AuthTokens>(email, password);
    const session: StoredSession = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
    setTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });
    writeStored(session);
    setUser(result.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      login,
      logout,
      hasRole: (...roles: UserRole[]) =>
        Boolean(user && (user.role === 'ADMIN' || roles.includes(user.role))),
      canWrite: Boolean(user && user.role !== 'AUDITOR' && user.role !== 'CONSULTA'),
    }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return context;
};
