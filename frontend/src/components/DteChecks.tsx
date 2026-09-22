import { Icon, type IconName } from './Icon';
import type { DteCheck } from '../lib/types';

const ICON: Record<DteCheck['status'], IconName> = {
  ok: 'checkCircle',
  info: 'info',
  warning: 'warning',
  error: 'danger',
};

const ORDER: Record<DteCheck['status'], number> = { error: 0, warning: 1, info: 2, ok: 3 };

/**
 * Resultado de la verificacion previa del DT-e. Primero lo que impide emitir,
 * despues lo que conviene revisar y al final lo que esta bien: quien lo lee
 * tiene que encontrar el problema sin recorrer la lista entera.
 */
export const DteChecks = ({ checks }: { checks: DteCheck[] }) => (
  <ul className="check-list" aria-label="Verificación previa">
    {[...checks]
      .sort((a, b) => ORDER[a.status] - ORDER[b.status])
      .map((check, index) => (
        <li key={`${check.code}-${index}`} className={`check check-${check.status}`}>
          <Icon name={ICON[check.status]} size={16} />
          <div>
            <div className="check-label">{check.label}</div>
            <div className="check-message">{check.message}</div>
          </div>
        </li>
      ))}
  </ul>
);
