import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { NetworkError } from '../lib/api';
import { toUserMessage } from '../lib/errors';
import { Logo } from '../components/Icon';
import { Button, Card, Notice } from '../components/ui';

/** Usuarios de prueba del seed. */
const DEMO_USERS = [
  { label: 'Administrador', email: 'admin@apitrace', role: 'ADMIN' },
  { label: 'Productor', email: 'productor@apitrace', role: 'PRODUCTOR' },
  { label: 'Sala', email: 'sala@apitrace', role: 'SALA' },
  { label: 'Acopiador', email: 'acopio@apitrace', role: 'ACOPIADOR' },
  { label: 'Auditor', email: 'auditor@apitrace', role: 'AUDITOR' },
  { label: 'Laboratorio', email: 'laboratorio@apitrace', role: 'LABORATORIO' },
];

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);

  const attempt = async (targetEmail: string, targetPassword: string) => {
    setBusy(true);
    setError(null);
    try {
      await login(targetEmail.trim(), targetPassword);
      navigate('/', { replace: true });
    } catch (cause) {
      if (cause instanceof NetworkError) {
        // Distincion importante: una sesión ya iniciada funciona sin señal,
        // pero la primera vez hace falta llegar al servidor.
        setError({
          title: 'No llegamos al servidor',
          detail: 'Para entrar por primera vez hace falta conexión. Una vez adentro, la app funciona sin señal.',
        });
      } else {
        const message = toUserMessage(cause);
        setError({ title: message.title, detail: message.detail });
      }
    } finally {
      setBusy(false);
    }
  };

  const fillAndLogin = (targetEmail: string, targetPassword = 'ApiTrace2026!') => {
    setEmail(targetEmail);
    setPassword(targetPassword);
    setFieldErrors({});
    void attempt(targetEmail, targetPassword);
  };

  /**
   * El boton nunca se deshabilita por campos vacios: un control apagado no
   * explica que falta. Se valida al enviar y el mensaje aparece junto al campo
   * que lo causo.
   */
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found: { email?: string; password?: string } = {};
    if (!email.trim()) found.email = 'Escribí tu correo.';
    if (!password) found.password = 'Escribí tu contraseña.';
    setFieldErrors(found);
    if (Object.keys(found).length > 0) return;
    void attempt(email, password);
  };

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <div className="auth-brand">
          <Logo size={38} />
          <span>ApiTrace</span>
        </div>

        <Card>
          <h2 style={{ marginBottom: 'var(--sp-1)' }}>Iniciar sesión</h2>
          <p className="small muted" style={{ marginBottom: 'var(--sp-5)' }}>
            Trazabilidad apícola argentina.
          </p>

          {error && (
            <div style={{ marginBottom: 'var(--sp-4)' }}>
              <Notice tone="danger" title={error.title}>
                {error.detail}
              </Notice>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="email">
                Correo electrónico
              </label>
              <input
                id="email"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="ej: productor@apitrace"
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              {fieldErrors.email && (
                <span className="field-error" id="email-error">
                  {fieldErrors.email}
                </span>
              )}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="password">
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={fieldErrors.password ? true : undefined}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  style={{ paddingRight: 'var(--sp-12)' }}
                />
                {/* Escribir a ciegas en un telefono, con guantes o a pleno sol,
                    es la causa mas comun de un intento fallido. */}
                <button
                  type="button"
                  className="reveal-btn"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {fieldErrors.password && (
                <span className="field-error" id="password-error">
                  {fieldErrors.password}
                </span>
              )}
            </div>
            <Button type="submit" variant="primary" block busy={busy} busyLabel="Entrando…">
              Entrar
            </Button>
          </form>

          <details className="disclosure" open style={{ marginTop: 'var(--sp-5)' }}>
            <summary>Acceso rápido con usuarios de prueba</summary>
            <div className="disclosure-body" style={{ paddingBottom: 'var(--sp-4)' }}>
              <p className="small muted" style={{ marginBottom: 'var(--sp-3)', lineHeight: 1.4 }}>
                Hacé clic en cualquier rol para ingresar directamente (contraseña: <code>ApiTrace2026!</code>):
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 'var(--sp-2)',
                }}
              >
                {DEMO_USERS.map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => fillAndLogin(demo.email, 'ApiTrace2026!')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: 'var(--sp-2) var(--sp-3)',
                      textAlign: 'left',
                      height: 'auto',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{demo.label}</span>
                    <span className="small muted" style={{ fontSize: '0.75rem' }}>
                      {demo.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </details>
        </Card>

        <p className="auth-foot">Una vez dentro, la aplicación funciona sin conexión.</p>
      </div>
    </div>
  );
};
