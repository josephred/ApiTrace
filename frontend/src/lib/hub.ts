import type { HeroIconName } from '../components/Illustrations';
import type { UserRole } from './types';

export interface HubItem {
  to: string;
  icon: HeroIconName;
  title: string;
  detail: string;
  roles: UserRole[];
}

/** Quienes ven y cargan apiarios y fincas: el apicultor (y quien lo audita). */
const BEEKEEPING: UserRole[] = ['ADMIN', 'PRODUCTOR', 'AUDITOR'];

/**
 * Opciones de «Carga de datos», en el orden de la captura de Rodrigo (doc 14):
 * Apiario, Finca / Polinización, Sala de extracción, Sala de fraccionamiento y
 * Traslados. Todas con el mismo estilo de tarjeta: ninguna va resaltada. Como
 * en su captura, la finca lleva acá la flor en el campo y en su formulario, el
 * granero con el árbol y la abeja.
 */
export const hubItems = (apiaryTotal = 0): HubItem[] => [
  {
    to: '/apiaries',
    icon: 'hivePlus',
    title: 'Apiario',
    detail:
      apiaryTotal > 0
        ? `Cargá tus ${apiaryTotal} apiarios por zona`
        : 'Cargá tus apiarios por zona',
    roles: BEEKEEPING,
  },
  {
    to: '/fincas',
    icon: 'fieldPlus',
    title: 'Finca / Polinización',
    detail: 'Registro de fincas y polinización',
    roles: BEEKEEPING,
  },
  {
    to: '/salas/extraccion',
    icon: 'databasePlus',
    title: 'Sala de extracción',
    detail: 'Registro de tambores y ingreso a SITA',
    roles: ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'AUDITOR'],
  },
  {
    to: '/salas/fraccionamiento',
    icon: 'jarPlus',
    title: 'Sala de fraccionamiento',
    detail: 'Registro de frascos, lotes y productos',
    roles: ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'AUDITOR'],
  },
  {
    to: '/traslados',
    icon: 'truckPlus',
    title: 'Traslados',
    detail: 'DT-e y movimientos',
    roles: ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'TRANSPORTISTA', 'AUDITOR'],
  },
];

/** Las opciones que ve cada rol; la numeración se arma con lo visible. */
export const hubItemsFor = (role: UserRole | undefined, apiaryTotal = 0): HubItem[] =>
  hubItems(apiaryTotal).filter((item) => role && (role === 'ADMIN' || item.roles.includes(role)));
