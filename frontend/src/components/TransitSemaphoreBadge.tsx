import type { TransitSemaphore } from '../lib/dte';

interface TransitSemaphoreBadgeProps {
  semaphore?: TransitSemaphore;
  reason?: string;
  size?: 'sm' | 'md' | 'lg';
  showReason?: boolean;
}

const SEMAPHORE_CONFIG: Record<
  TransitSemaphore,
  { label: string; bg: string; border: string; text: string; dot: string }
> = {
  VERDE: {
    label: 'Habilitado en ruta',
    bg: 'rgba(34, 197, 94, 0.12)',
    border: 'rgba(34, 197, 94, 0.4)',
    text: '#16a34a',
    dot: '#22c55e',
  },
  AMARILLO: {
    label: 'Vence hoy',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.4)',
    text: '#d97706',
    dot: '#f59e0b',
  },
  ROJO: {
    label: 'Tránsito no autorizado',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.4)',
    text: '#dc2626',
    dot: '#ef4444',
  },
  AZUL: {
    label: 'Cerrado en destino',
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.4)',
    text: '#2563eb',
    dot: '#3b82f6',
  },
  GRIS: {
    label: 'Sin arribo',
    bg: 'rgba(107, 114, 128, 0.12)',
    border: 'rgba(107, 114, 128, 0.4)',
    text: '#6b7280',
    dot: '#9ca3af',
  },
};

export const TransitSemaphoreBadge = ({
  semaphore = 'GRIS',
  reason,
  size = 'md',
  showReason = false,
}: TransitSemaphoreBadgeProps) => {
  const cfg = SEMAPHORE_CONFIG[semaphore] ?? SEMAPHORE_CONFIG.GRIS;

  const pad = size === 'sm' ? '2px 8px' : size === 'lg' ? '6px 14px' : '4px 10px';
  const fontSize = size === 'sm' ? '0.75rem' : size === 'lg' ? '0.95rem' : '0.825rem';
  const dotSize = size === 'sm' ? 6 : size === 'lg' ? 10 : 8;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: pad,
          borderRadius: '9999px',
          backgroundColor: cfg.bg,
          border: `1px solid ${cfg.border}`,
          color: cfg.text,
          fontWeight: 600,
          fontSize,
          letterSpacing: '0.01em',
          width: 'fit-content',
        }}
      >
        <span
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: cfg.dot,
            display: 'inline-block',
            boxShadow: `0 0 6px ${cfg.dot}`,
          }}
        />
        {cfg.label}
      </span>
      {showReason && reason && (
        <span className="small muted" style={{ maxWidth: '340px' }}>
          {reason}
        </span>
      )}
    </div>
  );
};
