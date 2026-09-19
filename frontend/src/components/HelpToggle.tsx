import { useHelpSettings } from '../lib/helpContext';
import { Icon } from './Icon';

interface HelpToggleProps {
  compact?: boolean;
}

/**
 * Interruptor de ayuda contextual del sistema.
 *
 * Permite a los usuarios principiantes acceder a definiciones, ejemplos prácticos
 * y citas normativas en cada sección, y a los usuarios experimentados desactivar
 * las burbujas para una interfaz más despejada.
 */
export const HelpToggle = ({ compact }: HelpToggleProps) => {
  const { helpEnabled, setHelpEnabled } = useHelpSettings();

  return (
    <div className="help-toggle" role="group" aria-label="Modo de ayuda contextual">
      <button
        type="button"
        className="help-toggle-option"
        aria-pressed={helpEnabled}
        onClick={() => setHelpEnabled(true)}
        title="Mostrar botones y popups de ayuda contextual"
      >
        <Icon name="help" size={14} />
        {!compact && <span>Con ayuda</span>}
      </button>
      <button
        type="button"
        className="help-toggle-option"
        aria-pressed={!helpEnabled}
        onClick={() => setHelpEnabled(false)}
        title="Ocultar botones de ayuda contextual"
      >
        <Icon name="close" size={14} />
        {!compact && <span>Sin ayuda</span>}
      </button>
    </div>
  );
};
