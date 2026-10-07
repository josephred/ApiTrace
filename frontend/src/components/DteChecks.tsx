import { Icon, type IconName } from './Icon';
import type { DteCheck } from '../lib/types';

const ICON: Record<DteCheck['status'], IconName> = {
  ok: 'checkCircle',
  info: 'info',
  warning: 'warning',
  error: 'danger',
};

const ORDER: Record<DteCheck['status'], number> = { error: 0, warning: 1, info: 2, ok: 3 };

const Item = ({ check }: { check: DteCheck }) => (
  <li className={`check check-${check.status}`}>
    <Icon name={ICON[check.status]} size={16} />
    <div>
      <div className="check-label">{check.label}</div>
      <div className="check-message">{check.message}</div>
    </div>
  </li>
);

/**
 * Resultado de la verificacion previa del DT-e. Primero lo que impide emitir,
 * despues lo que conviene revisar y al final lo que esta bien: quien lo lee
 * tiene que encontrar el problema sin recorrer la lista entera.
 *
 * Con `collapseOk`, lo que esta en regla queda plegado en una sola linea («8
 * controles en regla»): en el telefono, diez tarjetas verdes empujaban el
 * boton de emitir fuera de la pantalla sin decir nada nuevo.
 */
export const DteChecks = ({ checks, collapseOk }: { checks: DteCheck[]; collapseOk?: boolean }) => {
  const sorted = [...checks].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  if (!collapseOk) {
    return (
      <ul className="check-list" aria-label="Verificación previa">
        {sorted.map((check, index) => (
          <Item key={`${check.code}-${index}`} check={check} />
        ))}
      </ul>
    );
  }

  const pending = sorted.filter((check) => check.status !== 'ok');
  const passed = sorted.filter((check) => check.status === 'ok');
  return (
    <div className="check-groups">
      {pending.length > 0 && (
        <ul className="check-list" aria-label="Para revisar">
          {pending.map((check, index) => (
            <Item key={`${check.code}-${index}`} check={check} />
          ))}
        </ul>
      )}
      {passed.length > 0 && (
        <details className="disclosure check-passed">
          <summary>
            <Icon name="forward" size={14} className="chevron" />
            <Icon name="checkCircle" size={16} className="check-passed-icon" />
            {passed.length === 1 ? 'Un control en regla' : `${passed.length} controles en regla`}
          </summary>
          <div className="disclosure-body">
            <ul className="check-list">
              {passed.map((check, index) => (
                <Item key={`${check.code}-${index}`} check={check} />
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
};
