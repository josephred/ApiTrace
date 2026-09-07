import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, NetworkError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Notice } from '../components/ui';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (cause) {
      if (cause instanceof NetworkError) {
        // Distincion importante: sin red no se puede iniciar sesion, pero una
        // sesion ya iniciada sigue funcionando offline.
        setError(
          'Sin conexión con el servidor. Para iniciar sesión por primera vez hace falta señal.',
        );
      } else if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError('No se pudo iniciar sesión.');
      }
    } finally {
      setBusy(false);
    }
  };

  const quickLogin = async (targetEmail: string, targetPass = 'ApiTrace2026!') => {
    setEmail(targetEmail);
    setPassword(targetPass);
    setBusy(true);
    setError(null);
    try {
      await login(targetEmail, targetPass);
      navigate('/', { replace: true });
    } catch (cause) {
      if (cause instanceof NetworkError) {
        setError(
          'Sin conexión con el servidor. Para iniciar sesión por primera vez hace falta señal.',
        );
      } else if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError('No se pudo iniciar sesión.');
      }
    } finally {
      setBusy(false);
    }
  };

  const demoUsers = [
    { label: 'Admin', email: 'admin@apitrace.test', role: 'ADMIN', color: '#8b5cf6' },
    { label: 'Productor', email: 'productor@apitrace.test', role: 'PRODUCTOR', color: '#10b981' },
    { label: 'Sala Extracción', email: 'sala@apitrace.test', role: 'SALA', color: '#f59e0b' },
    { label: 'Acopiador', email: 'acopio@apitrace.test', role: 'ACOPIADOR', color: '#3b82f6' },
    { label: 'Auditor', email: 'auditor@apitrace.test', role: 'AUDITOR', color: '#6b7280' },
    { label: 'Laboratorio', email: 'laboratorio@apitrace.test', role: 'LAB', color: '#ec4899' },
  ];

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: '1.5rem 1rem' }}>
      <div style={{ width: 'min(440px, 100%)' }}>
        <div className="row" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
          <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="var(--accent)" />
            <g fill="none" stroke="var(--accent-contrast)" strokeWidth="3" strokeLinejoin="round">
              <path d="M32 12l7 4v8l-7 4-7-4v-8z" />
              <path d="M18 34l7 4v8l-7 4-7-4v-8z" />
              <path d="M46 34l7 4v8l-7 4-7-4v-8z" />
            </g>
            <path
              d="M32 32l7 4v8l-7 4-7-4v-8z"
              fill="var(--text)"
              stroke="var(--accent-contrast)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
          <h1 style={{ margin: 0 }}>ApiTrace</h1>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 style={{ marginBottom: '0.25rem' }}>Iniciar sesión</h2>
            <p className="muted small">Trazabilidad apícola argentina.</p>

            {error && <Notice tone="danger">{error}</Notice>}

            <form onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="email">Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <button type="submit" className="primary" style={{ width: '100%' }} disabled={busy}>
                {busy && <span className="spinner" aria-hidden="true" />}
                Entrar
              </button>
            </form>

            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px dashed var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span className="small muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Acceso Rápido (Modo Dev)
                </span>
                <span className="badge" style={{ fontSize: '0.7rem' }}>Demo</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                {demoUsers.map((user) => (
                  <button
                    key={user.email}
                    type="button"
                    disabled={busy}
                    onClick={() => quickLogin(user.email)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '0.5rem 0.65rem',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.background = 'var(--accent-soft)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--surface-2)';
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{user.label}</span>
                    <span className="small muted" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {user.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="small faint mt" style={{ textAlign: 'center' }}>
          Una vez iniciada la sesión, la aplicación funciona sin conexión.
        </p>
      </div>
    </div>
  );
};
