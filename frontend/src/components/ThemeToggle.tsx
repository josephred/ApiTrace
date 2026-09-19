import { useTheme, type Theme } from '../lib/theme';
import { Icon } from './Icon';

const OPCIONES: { value: Theme; label: string; icon: 'sun' | 'moon' }[] = [
  { value: 'light', label: 'Claro', icon: 'sun' },
  { value: 'dark', label: 'Oscuro', icon: 'moon' },
];

/**
 * Elección de tema.
 *
 * Se muestran las dos opciones a la vez en lugar de un interruptor que alterna:
 * un interruptor obliga a deducir en qué estado está y qué va a pasar al
 * tocarlo. Acá se ve cuál está activa y qué hace la otra.
 */
export const ThemeToggle = ({ compact }: { compact?: boolean }) => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-toggle" role="group" aria-label="Tema de la aplicación">
      {OPCIONES.map((opcion) => (
        <button
          key={opcion.value}
          type="button"
          className="theme-option"
          aria-pressed={theme === opcion.value}
          onClick={() => setTheme(opcion.value)}
          title={`Tema ${opcion.label.toLowerCase()}`}
        >
          <Icon name={opcion.icon} size={14} />
          {!compact && opcion.label}
        </button>
      ))}
    </div>
  );
};
