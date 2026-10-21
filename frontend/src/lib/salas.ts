import type { HeroIconName } from '../components/Illustrations';

/** Las dos salas del rediseño (doc 13) y cómo se llaman en cada pantalla. */
export type SalaKind = 'extraccion' | 'fraccionamiento';

export const SALA_KINDS: Record<
  SalaKind,
  { type: string; title: string; noun: string; icon: HeroIconName; list: string }
> = {
  extraccion: {
    type: 'SALA_EXTRACCION',
    title: 'Sala de extracción',
    noun: 'sala de extracción',
    icon: 'databaseDrop',
    list: '/salas/extraccion',
  },
  fraccionamiento: {
    type: 'FRACCIONADORA',
    title: 'Sala de fraccionamiento',
    noun: 'sala de fraccionamiento',
    icon: 'jarComb',
    list: '/salas/fraccionamiento',
  },
};

