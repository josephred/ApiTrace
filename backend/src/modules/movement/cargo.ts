/**
 * Vocabulario del asistente «Nuevo tramite DT-e» (migracion 0003).
 *
 * El apicultor elige que transporta (paso 1), de donde sale (paso 4) y a
 * donde va (paso 5). Aca se traduce esa eleccion al modelo canonico del
 * movimiento (tipo, material y unidad) y se decide si el tramite es un DT-e
 * API-SEM —el unico que ApiTrace pide hoy a SIGSA— o un tramite que se emite
 * en SIGSA y se registra con su numero.
 *
 * Funciones puras: las usan el servicio, la verificacion previa y las pruebas
 * (cargo.spec.ts) sin tocar la base.
 */

export const CARGO_TYPES = ['ALZAS', 'COLMENAS', 'NUCLEOS', 'TAMBORES', 'FRASCOS', 'REINAS'] as const;
export type CargoType = (typeof CARGO_TYPES)[number];

/** Tipos de lugar de los pasos 4 y 5, en el orden de la pantalla. */
export const PLACE_TYPES = [
  'APIARIO',
  'FINCA_POLINIZACION',
  'DEPOSITO',
  'SALA_EXTRACCION',
  'SALA_FRACCIONAMIENTO',
] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

type MovementTypeName =
  | 'MATERIAL_MELARIO'
  | 'MIEL_A_GRANEL'
  | 'PRODUCTO_FRACCIONADO'
  | 'MATERIAL_VIVO'
  | 'MATERIAL_INERTE'
  | 'OTRO';
type MaterialTypeName =
  | 'MATERIAL_MELARIO'
  | 'MIEL'
  | 'CERA'
  | 'POLEN'
  | 'PROPOLEO'
  | 'JALEA_REAL'
  | 'NUCLEO'
  | 'COLMENA'
  | 'OTRO'
  | 'REINA';
type UnitName = 'KG' | 'LITRO' | 'ALZA' | 'TAMBOR' | 'COLMENA' | 'UNIDAD';

export interface CargoProfile {
  movementType: MovementTypeName;
  materialType: MaterialTypeName;
  unit: UnitName;
  /** «Alzas», «Colmenas»… */
  label: string;
  /** Para frases: «100 alzas», «1 tambor». */
  singular: string;
  plural: string;
}

export const CARGO_PROFILE: Record<CargoType, CargoProfile> = {
  ALZAS: {
    movementType: 'MATERIAL_MELARIO',
    materialType: 'MATERIAL_MELARIO',
    unit: 'ALZA',
    label: 'Alzas',
    singular: 'alza',
    plural: 'alzas',
  },
  COLMENAS: {
    movementType: 'MATERIAL_VIVO',
    materialType: 'COLMENA',
    unit: 'COLMENA',
    label: 'Colmenas',
    singular: 'colmena',
    plural: 'colmenas',
  },
  NUCLEOS: {
    movementType: 'MATERIAL_VIVO',
    materialType: 'NUCLEO',
    unit: 'UNIDAD',
    label: 'Nucleos',
    singular: 'nucleo',
    plural: 'nucleos',
  },
  TAMBORES: {
    movementType: 'MIEL_A_GRANEL',
    materialType: 'MIEL',
    unit: 'TAMBOR',
    label: 'Tambores',
    singular: 'tambor',
    plural: 'tambores',
  },
  FRASCOS: {
    movementType: 'PRODUCTO_FRACCIONADO',
    materialType: 'MIEL',
    unit: 'UNIDAD',
    label: 'Frascos',
    singular: 'frasco',
    plural: 'frascos',
  },
  REINAS: {
    movementType: 'MATERIAL_VIVO',
    materialType: 'REINA',
    unit: 'UNIDAD',
    label: 'Reinas',
    singular: 'reina',
    plural: 'reinas',
  },
};

/** Tipos de establecimiento que corresponden a cada tipo de lugar. */
export const PLACE_ESTABLISHMENT_TYPES: Record<PlaceType, readonly string[]> = {
  APIARIO: ['APIARIO_BASE'],
  FINCA_POLINIZACION: ['FINCA_POLINIZACION'],
  DEPOSITO: ['DEPOSITO', 'ACOPIO'],
  SALA_EXTRACCION: ['SALA_EXTRACCION'],
  SALA_FRACCIONAMIENTO: ['FRACCIONADORA'],
};

/** Tipo de lugar de un establecimiento (null si no figura en el asistente). */
export const placeTypeOfEstablishment = (type: string): PlaceType | null => {
  for (const place of PLACE_TYPES) {
    if (PLACE_ESTABLISHMENT_TYPES[place].includes(type)) return place;
  }
  return null;
};

/**
 * Lo que transporta un movimiento ya registrado, si se puede saber sin
 * adivinar (los anteriores a la migracion 0003 no lo guardaban).
 */
export const cargoOfMovement = (input: {
  cargoType?: string | null;
  movementType: string;
  materialType: string;
  unit: string;
}): CargoType | null => {
  if (input.cargoType && (CARGO_TYPES as readonly string[]).includes(input.cargoType)) {
    return input.cargoType as CargoType;
  }
  if (input.materialType === 'MATERIAL_MELARIO') return 'ALZAS';
  if (input.materialType === 'COLMENA') return 'COLMENAS';
  if (input.materialType === 'NUCLEO') return 'NUCLEOS';
  if (input.materialType === 'REINA') return 'REINAS';
  if (input.movementType === 'PRODUCTO_FRACCIONADO') return 'FRASCOS';
  if (input.materialType === 'MIEL' && (input.unit === 'TAMBOR' || input.movementType === 'MIEL_A_GRANEL')) {
    return 'TAMBORES';
  }
  return null;
};

/**
 * DT-e API-SEM: alzas melarias de un apiario a una sala de extraccion
 * (especificacion 4.1). Es el unico que ApiTrace pide a SIGSA por API; el
 * resto se emite en SIGSA y se registra con su numero.
 */
export const isApiSemRoute = (
  cargo: CargoType,
  origin: PlaceType | null,
  destination: PlaceType | null,
): boolean => cargo === 'ALZAS' && origin === 'APIARIO' && destination === 'SALA_EXTRACCION';

/** «100 alzas», «1 tambor». */
export const describeQuantity = (cargo: CargoType, quantity: number): string => {
  const profile = CARGO_PROFILE[cargo];
  return `${quantity} ${quantity === 1 ? profile.singular : profile.plural}`;
};

/**
 * Motivo de transito legible para un tramite que no es API-SEM. Lo ve la
 * persona; no reemplaza al codigo oficial que asigne SIGSA.
 */
export const transitReasonFor = (cargo: CargoType, destination: PlaceType | null): string => {
  if (destination === 'FINCA_POLINIZACION') return 'Polinizacion';
  if (destination === 'SALA_EXTRACCION' && cargo === 'ALZAS') return 'Extraccion de miel';
  if (destination === 'SALA_FRACCIONAMIENTO') return 'Fraccionamiento';
  if (cargo === 'TAMBORES' || cargo === 'FRASCOS') return 'Comercializacion o deposito';
  if (cargo === 'COLMENAS' || cargo === 'NUCLEOS' || cargo === 'REINAS') return 'Traslado de material vivo';
  return 'Traslado';
};
