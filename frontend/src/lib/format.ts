const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' });
const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
});
const numberFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 });

export const formatDate = (value: string | number | Date | null | undefined): string =>
  value ? dateFormatter.format(new Date(value)) : '—';

export const formatDateTime = (value: string | number | Date | null | undefined): string =>
  value ? dateTimeFormatter.format(new Date(value)) : '—';

export const formatQuantity = (
  value: string | number | null | undefined,
  unit?: string | null,
): string => {
  if (value === null || value === undefined || value === '') return '—';
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  if (Number.isNaN(parsed)) return '—';
  return unit ? `${numberFormatter.format(parsed)} ${unit}` : numberFormatter.format(parsed);
};

/** "hace 3 minutos", para indicar cuan viejo es un dato servido del cache. */
export const formatRelative = (timestamp: number | null | undefined): string => {
  if (!timestamp) return 'nunca';
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'hace instantes';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
};

/** Convierte SALA_EXTRACCION en "Sala extraccion" para mostrar en la interfaz. */
export const humanize = (value: string | null | undefined): string => {
  if (!value) return '—';
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

/** Fecha en formato datetime-local para prellenar formularios. */
export const toLocalInput = (date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const toIso = (localValue: string): string => new Date(localValue).toISOString();

/** CUIT con guiones (30-71234567-9). Si no tiene 11 digitos, se devuelve tal cual. */
export const formatCuit = (value: string | null | undefined): string => {
  if (!value) return '—';
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 ? `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}` : value;
};
