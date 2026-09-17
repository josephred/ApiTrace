import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { NetworkError } from '../lib/api';
import { toUserMessage } from '../lib/errors';
import { Logo } from '../components/Icon';
import { Button, Card, Notice } from '../components/ui';

/** Usuarios de prueba del seed. Solo existen durante el desarrollo. */
const DEMO_USERS = [
  { label: 'Administrador', email: 'admin@apitrace.test' },
  { label: 'Productor', email: 'productor@apitrace.test' },
  { label: 'Sala', email: 'sala@apitrace.test' },
  { label: 'Acopiador', email: 'acopio@apitrace.test' },
  { label: 'Auditor', email: 'auditor@apitrace.test' },
  { label: 'Laboratorio', email: 'laboratorio@apitrace.test' },
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
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
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

          {/*
            El acceso rápido existe para probar roles sin recordar seis
            contrasenas. Queda fuera del paquete de producción: mostrar usuarios
            y claves reales en la pantalla de acceso arruina la confianza que la
            aplicación necesita transmitir, además del riesgo obvio.
          */}
          {import.meta.env.DEV && (
            <details className="disclosure" style={{ marginTop: 'var(--sp-5)' }}>
              <summary>Acceso rápido para pruebas</summary>
              <div className="disclosure-body" style={{ paddingBottom: 'var(--sp-4)' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 'var(--sp-2)',
                  }}
                >
                  {DEMO_USERS.map((demo) => (
                    <Button
                      key={demo.email}
                      size="sm"
                      disabled={busy}
                      onClick={() => void attempt(demo.email, 'ApiTrace2026!')}
                    >
                      {demo.label}
                    </Button>
                  ))}
                </div>
              </div>
            </details>
          )}
        </Card>

        <p className="auth-foot">Una vez dentro, la aplicación funciona sin conexión.</p>
      </div>
    </div>
  );
};
