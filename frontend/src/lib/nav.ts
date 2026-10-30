import type { IconName } from '../components/Icon';
import type { UserRole } from './types';

/** Roles que trabajan con DT-e (los mismos que App.tsx). */
export const DTE_ROLES: UserRole[] = ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'AUDITOR'];

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
      { to: '/', label: 'Inicio', icon: 'home', end: true },
      { to: '/mapa', label: 'Mapa', icon: 'map' },
      {
        to: '/dte',
        label: (role) => (role === 'SALA' || role === 'ACOPIADOR' ? 'DT-e recibidos' : 'DT-e'),
        icon: 'fileLines',
        roles: DTE_ROLES,
      },
      {
        to: '/carga',
        label: 'Carga de datos',
        icon: 'layers',
        roles: ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'TRANSPORTISTA', 'AUDITOR'],
      },
    ],
  },
  {
    group: 'Maestros',
    items: [
      {
        to: '/apiaries',
        label: 'Apiarios',
        icon: 'apiaries',
        roles: ['ADMIN', 'PRODUCTOR', 'AUDITOR'],
      },
      {
        to: '/fincas',
        label: 'Fincas de polinización',
        icon: 'flower',
        roles: ['ADMIN', 'PRODUCTOR', 'AUDITOR'],
      },
      {
        to: '/salas/extraccion',
        label: 'Salas de extracción',
        icon: 'extractions',
        roles: ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'AUDITOR'],
      },
      {
        to: '/salas/fraccionamiento',
        label: 'Salas de fraccionamiento',
        icon: 'jar',
        roles: ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'AUDITOR'],
      },
      {
        to: '/traslados',
        label: 'Traslados',
        icon: 'movements',
        roles: ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'TRANSPORTISTA', 'AUDITOR'],
      },
    ],
  },
  {
    group: 'Operación',
    items: [
      {
        to: '/movements',
        label: 'Movimientos',
        icon: 'route',
        roles: ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'TRANSPORTISTA', 'AUDITOR'],
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
      { to: '/trace', label: 'Trazabilidad', icon: 'trace' },
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
 * La barra inferior del teléfono (doc 13): Inicio, Mapa, DT-e y
 * Configuración, para todos. Quien no trabaja con DT-e ve Traslados en ese
 * lugar, y si tampoco ve traslados, Trazabilidad. El resto de las secciones
 * vive en Inicio (Carga de datos) y en Configuración (Todas las secciones).
 */
export const quickNavFor = (role: UserRole): NavItem[] => {
  const available = new Map<string, NavItem>();
  for (const group of navFor(role)) for (const item of group.items) available.set(item.to, item);

  const third =
    available.get('/dte') ??
    (available.has('/traslados')
      ? { ...available.get('/traslados')!, label: 'Traslados' }
      : available.get('/trace'));
  return [available.get('/'), available.get('/mapa'), third, available.get('/settings')].filter(
    (item): item is NavItem => Boolean(item),
  );
};
