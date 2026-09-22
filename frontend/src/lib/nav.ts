import type { IconName } from '../components/Icon';
import type { UserRole } from './types';

/**
 * Definicion única de la navegacion.
 *
 * La barra lateral de escritorio y la barra inferior del teléfono leen de acá,
 * de modo que un destino nuevo aparece en las dos sin duplicar la lista ni
 * arriesgar que diverjan.
 */

export interface NavItem {
  to: string;
  /** Algunos destinos cambian de nombre según el rol. */
  label: string | ((role: UserRole) => string);
  icon: IconName;
  end?: boolean;
  roles?: UserRole[];
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    group: 'Principal',
    items: [
      { to: '/', label: 'Panel', icon: 'dashboard', end: true },
      { to: '/trace', label: 'Trazabilidad', icon: 'trace' },
    ],
  },
  {
    group: 'Operación',
    items: [
      {
        to: '/movements',
        label: 'Movimientos',
        icon: 'movements',
        roles: ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'TRANSPORTISTA', 'AUDITOR'],
      },
      {
        to: '/dte',
        label: (role) => (role === 'SALA' || role === 'ACOPIADOR' ? 'DT-e recibidos' : 'Mis DT-e'),
        icon: 'document',
        roles: ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'AUDITOR'],
      },
      {
        to: '/extractions',
        label: 'Extracciones',
        icon: 'extractions',
        roles: ['ADMIN', 'SALA', 'ACOPIADOR', 'AUDITOR'],
      },
      {
        to: '/lots',
        label: 'Lotes',
        icon: 'lots',
        roles: ['ADMIN', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'LABORATORIO', 'AUDITOR'],
      },
      {
        to: '/drums',
        label: 'Tambores',
        icon: 'drums',
        roles: ['ADMIN', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'EXPORTADOR', 'AUDITOR'],
      },
    ],
  },
  {
    group: 'Registros',
    items: [
      {
        to: '/producers',
        label: (role) => (role === 'PRODUCTOR' ? 'Mis datos' : 'Productores'),
        icon: 'producers',
        roles: ['ADMIN', 'PRODUCTOR', 'AUDITOR'],
      },
      {
        to: '/establishments',
        label: 'Establecimientos',
        icon: 'establishments',
        roles: ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'AUDITOR'],
      },
      {
        to: '/apiaries',
        label: 'Apiarios',
        icon: 'apiaries',
        roles: ['ADMIN', 'PRODUCTOR', 'AUDITOR'],
      },
    ],
  },
  {
    group: 'Control',
    items: [
      { to: '/rules', label: 'Reglas', icon: 'rules', roles: ['ADMIN', 'AUDITOR'] },
      { to: '/audit', label: 'Auditoría', icon: 'audit', roles: ['ADMIN', 'AUDITOR'] },
    ],
  },
  {
    group: 'Sistema',
    items: [
      { to: '/settings', label: 'Configuración', icon: 'settings' },
      { to: '/pending', label: 'Pendientes', icon: 'sync' },
    ],
  },
];

export const itemLabel = (item: NavItem, role: UserRole): string =>
  typeof item.label === 'function' ? item.label(role) : item.label;

const allowed = (item: NavItem, role: UserRole): boolean =>
  !item.roles || role === 'ADMIN' || item.roles.includes(role);

export const navFor = (role: UserRole): NavGroup[] =>
  NAV.map((group) => ({ ...group, items: group.items.filter((item) => allowed(item, role)) })).filter(
    (group) => group.items.length > 0,
  );

/**
 * Las cuatro rutas que cada rol usa a diario. Son las que ocupan la barra
 * inferior en el teléfono; el resto vive detras de «Más».
 *
 * El criterio es el trabajo real de cada rol: un productor vive en sus apiarios
 * y en los traslados que salen de ellos; una sala, en lo que recibe y procesa;
 * un auditor, en consultar y revisar, no en cargar.
 */
const QUICK: Partial<Record<UserRole, string[]>> = {
  ADMIN: ['/', '/movements', '/dte', '/trace'],
  // El DT-e es lo que el productor gestiona a diario desde el 01/08/2026.
  PRODUCTOR: ['/', '/dte', '/movements', '/apiaries'],
  SALA: ['/', '/dte', '/movements', '/extractions'],
  ACOPIADOR: ['/', '/movements', '/lots', '/drums'],
  FRACCIONADOR: ['/', '/movements', '/lots', '/drums'],
  EXPORTADOR: ['/', '/drums', '/lots', '/trace'],
  LABORATORIO: ['/', '/lots', '/trace', '/pending'],
  TRANSPORTISTA: ['/', '/movements', '/trace', '/pending'],
  AUDITOR: ['/', '/trace', '/movements', '/audit'],
  CONSULTA: ['/', '/trace', '/movements', '/lots'],
};

export const quickNavFor = (role: UserRole): NavItem[] => {
  const groups = navFor(role);
  const available = new Map<string, NavItem>();
  for (const group of groups) for (const item of group.items) available.set(item.to, item);

  const wanted = QUICK[role] ?? ['/', '/movements', '/trace'];
  const picked = wanted.map((to) => available.get(to)).filter((item): item is NavItem => Boolean(item));

  // Relleno por si el rol no habilita alguno de sus destinos preferidos.
  if (picked.length < 4) {
    for (const item of available.values()) {
      if (picked.length >= 4) break;
      if (!picked.includes(item)) picked.push(item);
    }
  }
  return picked.slice(0, 4);
};
