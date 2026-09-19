import { Icon } from './Icon';
import { Pill } from './ui';
import type { DtePreflightCheck, DtePreflightResult } from '../lib/types';

interface DteChecksProps {
  result?: DtePreflightResult | null;
  checks?: DtePreflightCheck[];
}

export const DteChecks = ({ result, checks: propsChecks }: DteChecksProps) => {
  const checks = propsChecks ?? result?.checks ?? [];

  if (checks.length === 0) {
    return (
      <div className="small muted">
        No se han ejecutado validaciones automáticas.
      </div>
    );
  }

  const errors = checks.filter((c) => !c.passed && c.severity === 'ERROR');
  const warnings = checks.filter((c) => c.severity === 'WARNING' || (!c.passed && c.severity !== 'ERROR'));

  return (
    <div className="stack" style={{ gap: 'var(--sp-3)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="small font-medium">Validación previa SENASA</span>
        <div className="row row-tight">
          {errors.length > 0 ? (
            <Pill tone="danger" icon="danger">
              {errors.length} {errors.length === 1 ? 'error' : 'errores'}
            </Pill>
          ) : (
            <Pill tone="success" icon="checkCircle">
              Habilitado
            </Pill>
          )}
          {warnings.length > 0 && (
            <Pill tone="warning" icon="warning">
              {warnings.length} {warnings.length === 1 ? 'advertencia' : 'advertencias'}
            </Pill>
          )}
        </div>
      </div>

      <ul className="dte-checks-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        {checks.map((check) => {
          const isError = !check.passed && check.severity === 'ERROR';
          const isWarn = check.severity === 'WARNING';

          const tone = isError ? 'danger' : isWarn ? 'warning' : 'success';
          const icon = isError ? 'danger' : isWarn ? 'warning' : 'checkCircle';

          return (
            <li
              key={check.key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--sp-2)',
                padding: 'var(--sp-2) var(--sp-3)',
                borderRadius: 'var(--radius-sm)',
                background: isError ? 'rgba(239, 68, 68, 0.08)' : isWarn ? 'rgba(245, 158, 11, 0.08)' : 'rgba(34, 197, 94, 0.06)',
                borderLeft: `3px solid var(--${tone})`,
              }}
            >
              <span style={{ color: `var(--${tone})`, marginTop: 2, flexShrink: 0 }}>
                <Icon name={icon} size={16} />
              </span>
              <div className="stack" style={{ gap: 2, flex: 1 }}>
                <div className="small font-medium" style={{ color: 'var(--text-1)' }}>
                  {check.label}
                </div>
                <div className="small" style={{ color: isError ? 'var(--danger)' : isWarn ? 'var(--text-1)' : 'var(--text-2)' }}>
                  {check.message}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
