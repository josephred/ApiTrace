import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError, NetworkError } from '../lib/api';
import { toUserMessage } from '../lib/errors';
import { cuitDigits, isValidCuit, maskCuit } from '../lib/cuit';
import { Icon } from '../components/Icon';
import { Notice } from '../components/ui';
import { AppBar } from '../components/Screen';
import { FormHero, SubmitButton, TextFieldCard } from '../components/MasterForm';

const RENAPA = /^[A-Za-z0-9][A-Za-z0-9 ./-]{1,58}$/;

type Field = 'fullName' | 'taxId' | 'renapa' | 'password';

/**
 * «Creá tu cuenta» (doc 13): el apicultor se registra solo, desde el
 * teléfono, con su nombre, su CUIT, su RENAPA y una contraseña. La cuenta
 * queda activa como productor y después se entra con la CUIT.
 */
export const RegisterPage = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<Field, string>>({
    fullName: '',
    taxId: '',
    renapa: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): Partial<Record<Field, string>> => {
    const found: Partial<Record<Field, string>> = {};
    if (values.fullName.trim().length < 3) found.fullName = 'Escribí tu nombre completo.';
    const digits = cuitDigits(values.taxId);
    if (digits.length !== 11) found.taxId = 'La CUIT tiene 11 dígitos.';
    else if (!isValidCuit(digits)) found.taxId = 'Revisá la CUIT: el último dígito no coincide.';
    if (!RENAPA.test(values.renapa.trim())) found.renapa = 'Escribí tu número de RENAPA (por ejemplo B53999).';
    if (values.password.length < 8) found.password = 'Usá al menos 8 caracteres.';
    return found;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setFailure(null);
    try {
      await signup({
        fullName: values.fullName.trim(),
        taxId: cuitDigits(values.taxId),
        renapa: values.renapa.trim(),
        password: values.password,
      });
      navigate('/', { replace: true });
    } catch (cause) {
      if (cause instanceof NetworkError) {
        setFailure({
          title: 'No llegamos al servidor',
          detail: 'Para crear la cuenta hace falta conexión. Después, la app funciona sin señal.',
        });
      } else if (cause instanceof ApiError && cause.code === 'CUIT_REGISTRADA') {
        setErrors({ taxId: 'Ya hay una cuenta con esa CUIT. Iniciá sesión con ella.' });
      } else if (cause instanceof ApiError && cause.code === 'CUIT_INVALIDA') {
        setErrors({ taxId: 'Revisá la CUIT: el último dígito no coincide.' });
      } else if (cause instanceof ApiError && cause.code === 'RENAPA_REGISTRADO') {
        setErrors({ renapa: 'Ese RENAPA ya está registrado en ApiTrace.' });
      } else {
        const message = toUserMessage(cause, 'write');
        setFailure({ title: message.title, detail: message.detail });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <AppBar title="Registrarse" back="/login" />
      <form className="master-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        <FormHero
          icon="personPlus"
          title="Creá tu cuenta"
          subtitle="Completá los siguientes datos para registrarte en la plataforma."
        />

        {failure && (
          <Notice tone="danger" title={failure.title}>
            {failure.detail}
          </Notice>
        )}

        <TextFieldCard
          label="Nombre"
          name="name"
          icon="user"
          placeholder="Tu nombre completo"
          autoComplete="name"
          autoCapitalize="words"
          value={values.fullName}
          onChange={(value) => set('fullName', value)}
          error={errors.fullName}
          maxLength={160}
        />
        <TextFieldCard
          label="CUIT"
          name="username"
          icon="document"
          placeholder="11 dígitos"
          inputMode="numeric"
          autoComplete="off"
          value={maskCuit(values.taxId)}
          onChange={(value) => set('taxId', value)}
          error={errors.taxId}
          maxLength={13}
        />
        <TextFieldCard
          label="RENAPA"
          name="renapa"
          icon="honeycomb"
          placeholder="Tu número de RENAPA"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          value={values.renapa}
          onChange={(value) => set('renapa', value.toUpperCase())}
          error={errors.renapa}
          maxLength={60}
        />
        <TextFieldCard
          label="Contraseña"
          name="new-password"
          icon="lock"
          placeholder="Mínimo 8 caracteres"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={values.password}
          onChange={(value) => set('password', value)}
          error={errors.password}
          maxLength={100}
          hint="Con tu CUIT y esta contraseña entrás desde cualquier teléfono."
          trailing={
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

        <SubmitButton busy={busy} busyLabel="Creando la cuenta…">
          Crear Cuenta
        </SubmitButton>

        <p className="auth-switch">
          ¿Ya tenés una cuenta? <Link to="/login">Iniciar Sesión</Link>
        </p>
      </form>
    </div>
  );
};
