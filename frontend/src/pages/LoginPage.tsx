import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { NetworkError } from '../lib/api';
import { toUserMessage } from '../lib/errors';
import { Icon, Logo } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';
import { Notice } from '../components/ui';
import { FormHero, SubmitButton, TextFieldCard } from '../components/MasterForm';

/** Usuarios de prueba del seed (npm run db:seed). */
const DEMO_USERS = [
  { label: 'Administrador', email: 'admin@apitrace' },
  { label: 'Productor', email: 'productor@apitrace' },
  { label: 'Sala', email: 'sala@apitrace' },
  { label: 'Acopiador', email: 'acopio@apitrace' },
  { label: 'Auditor', email: 'auditor@apitrace' },
  { label: 'Laboratorio', email: 'laboratorio@apitrace' },
];

/**
 * Detección del entorno de Render o local. En dominios de Render (*.onrender.com o render.com),
 * o en localhost, se habilita el acceso rápido de demostración a menos que se desactive
 * explícitamente mediante VITE_DEMO_ACCESS=false.
 */
const isRenderHost =
  typeof window !== 'undefined' &&
  (window.location.hostname.endsWith('.onrender.com') ||
    window.location.hostname.includes('render.com') ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

/**
 * El acceso rápido existe para probar roles sin recordar seis contraseñas. Se
 * muestra en desarrollo, al desplegar en Render o cuando se declara VITE_DEMO_ACCESS=true,
 * salvo que se apague explícitamente con VITE_DEMO_ACCESS=false.
 */
const DEMO_ACCESS =
  import.meta.env.VITE_DEMO_ACCESS === 'true' ||
  (import.meta.env.VITE_DEMO_ACCESS !== 'false' && (import.meta.env.DEV || isRenderHost));

/**
 * Ingreso con el mismo lenguaje visual que «Creá tu cuenta» (doc 13): se
 * entra con la CUIT (cuentas creadas desde el teléfono) o con el correo.
 */
export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);

  const attempt = async (targetIdentifier: string, targetPassword: string) => {
    setBusy(true);
    setError(null);
    try {
      await login(targetIdentifier.trim(), targetPassword);
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
    const found: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) found.identifier = 'Escribí tu CUIT o tu correo.';
    if (!password) found.password = 'Escribí tu contraseña.';
    setFieldErrors(found);
    if (Object.keys(found).length > 0) return;
    void attempt(identifier, password);
  };

  return (
    <div className="auth-page">
      <div className="auth-top">
        <Logo size={30} />
        <span translate="no">ApiTrace</span>
      </div>
      <form className="master-form" onSubmit={onSubmit} noValidate>
        <FormHero
          icon="person"
          title="Iniciá sesión"
          subtitle="Entrá con tu CUIT o con tu correo. Una vez adentro, la app funciona sin conexión."
        />

        {error && (
          <Notice tone="danger" title={error.title}>
            {error.detail}
          </Notice>
        )}

        <TextFieldCard
          label="CUIT o correo"
          name="username"
          icon="user"
          placeholder="Ej. 20-12345678-6"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={identifier}
          onChange={setIdentifier}
          error={fieldErrors.identifier}
        />
        <TextFieldCard
          label="Contraseña"
          name="password"
          icon="lock"
          placeholder="Tu contraseña"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          trailing={
            // Escribir a ciegas en un teléfono, con guantes o a pleno sol, es
            // la causa más común de un intento fallido.
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowPassword((value) => !value)}
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={22} />
            </button>
          }
        />

        <SubmitButton busy={busy} busyLabel="Entrando…">
          Entrar
        </SubmitButton>

        <p className="auth-switch">
          ¿No tenés cuenta? <Link to="/registro">Creá tu cuenta</Link>
        </p>

        {DEMO_ACCESS && (
          <details className="demo-access" open>
            <summary>Acceso rápido para pruebas (cuentas demo)</summary>
            <p className="small muted">
              Tocá un rol para entrar (contraseña <code>ApiTrace2026!</code>):
            </p>
            <div className="demo-grid">
              {DEMO_USERS.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  className="chip-button"
                  disabled={busy}
                  onClick={() => void attempt(demo.email, 'ApiTrace2026!')}
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </details>
        )}

        <div className="auth-foot">
          <ThemeToggle />
        </div>
      </form>
    </div>
  );
};
