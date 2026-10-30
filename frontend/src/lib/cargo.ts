/**
 * Vocabulario del asistente «Nuevo trámite DT-e» (doc 13). Espejo de
 * backend/src/modules/movement/cargo.ts: qué se transporta, desde y hasta qué
 * tipo de lugar, y cuándo el trámite es un DT-e API-SEM.
 */

export const CARGO_TYPES = ['ALZAS', 'COLMENAS', 'NUCLEOS', 'TAMBORES', 'FRASCOS', 'REINAS'] as const;
export type CargoType = (typeof CARGO_TYPES)[number];

export const PLACE_TYPES = [
  'APIARIO',
  'FINCA_POLINIZACION',
  'DEPOSITO',
  'SALA_EXTRACCION',
  'SALA_FRACCIONAMIENTO',
] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

export interface CargoInfo {
  label: string;
  singular: string;
  plural: string;
  /** Atajos del paso 3. */
  presets: number[];
  /** Cantidad con la que arranca el contador. */
  initial: number;
  /** Lugar de salida y de llegada más habitual para esta carga. */
  usualOrigin: PlaceType;
  usualDestination: PlaceType;
}

export const CARGO: Record<CargoType, CargoInfo> = {
  ALZAS: {
    label: 'Alzas',
    singular: 'alza',
    plural: 'alzas',
    presets: [30, 60, 100, 200],
    initial: 60,
    usualOrigin: 'APIARIO',
    usualDestination: 'SALA_EXTRACCION',
  },
  COLMENAS: {
    label: 'Colmenas',
    singular: 'colmena',
    plural: 'colmenas',
    presets: [12, 24, 48, 96],
    initial: 24,
    usualOrigin: 'APIARIO',
    usualDestination: 'FINCA_POLINIZACION',
  },
  NUCLEOS: {
    label: 'Núcleos',
    singular: 'núcleo',
    plural: 'núcleos',
    presets: [5, 10, 20, 40],
    initial: 10,
    usualOrigin: 'APIARIO',
    usualDestination: 'APIARIO',
  },
  TAMBORES: {
    label: 'Tambor',
    singular: 'tambor',
    plural: 'tambores',
    presets: [4, 10, 20, 40],
    initial: 10,
    usualOrigin: 'SALA_EXTRACCION',
    usualDestination: 'SALA_FRACCIONAMIENTO',
  },
  FRASCOS: {
    label: 'Frascos',
    singular: 'frasco',
    plural: 'frascos',
    presets: [24, 48, 120, 240],
    initial: 48,
    usualOrigin: 'SALA_FRACCIONAMIENTO',
    usualDestination: 'DEPOSITO',
  },
  REINAS: {
    label: 'Reinas',
    singular: 'reina',
    plural: 'reinas',
    presets: [5, 10, 25, 50],
    initial: 10,
    usualOrigin: 'APIARIO',
    usualDestination: 'APIARIO',
  },
};

export interface PlaceInfo {
  /** Rótulo del mosaico («Finca Polinización»). */
  tile: string;
  /** Para frases: «el apiario», «la sala de extracción». */
  noun: string;
  /** «apiarios», «fincas de polinización»: el plural no siempre es noun + s. */
  plural: string;
  article: 'el' | 'la';
  search: string;
}

export const PLACES: Record<PlaceType, PlaceInfo> = {
  APIARIO: { tile: 'Apiario', noun: 'apiario', plural: 'apiarios', article: 'el', search: 'Buscar apiario…' },
  FINCA_POLINIZACION: {
    tile: 'Finca Polinización',
    noun: 'finca de polinización',
    plural: 'fincas de polinización',
    article: 'la',
    search: 'Buscar finca…',
  },
  DEPOSITO: { tile: 'Depósito', noun: 'depósito', plural: 'depósitos', article: 'el', search: 'Buscar depósito…' },
  SALA_EXTRACCION: {
    tile: 'Sala Extracción',
    noun: 'sala de extracción',
    plural: 'salas de extracción',
    article: 'la',
    search: 'Buscar sala…',
  },
  SALA_FRACCIONAMIENTO: {
    tile: 'Sala Fraccionamiento',
    noun: 'sala de fraccionamiento',
    plural: 'salas de fraccionamiento',
    article: 'la',
    search: 'Buscar sala…',
  },
};

/**
 * Lo que dicen los pasos 4 y 5 cuando no hay lugares de ese tipo: «No tenés
 * fincas de polinización registradas.», con el plural y el género de cada uno.
 */
export const noPlacesText = (type: PlaceType, side: 'origin' | 'destination'): string => {
  const info = PLACES[type];
  const registered = info.article === 'la' ? 'registradas' : 'registrados';
  return side === 'origin'
    ? `No tenés ${info.plural} ${registered}.`
    : `No hay ${info.plural} ${registered} como destino.`;
};

/** Tipo de establecimiento que se crea desde cada tipo de lugar. */
export const PLACE_ESTABLISHMENT_TYPE: Record<Exclude<PlaceType, 'APIARIO'>, string> = {
  FINCA_POLINIZACION: 'FINCA_POLINIZACION',
  DEPOSITO: 'DEPOSITO',
  SALA_EXTRACCION: 'SALA_EXTRACCION',
  SALA_FRACCIONAMIENTO: 'FRACCIONADORA',
};

/** El único trámite que ApiTrace pide a SIGSA por API: alzas de apiario a sala. */
export const isApiSem = (
  cargo: CargoType | null | undefined,
  origin: PlaceType | null | undefined,
  destination: PlaceType | null | undefined,
): boolean => cargo === 'ALZAS' && origin === 'APIARIO' && destination === 'SALA_EXTRACCION';

/** «100 alzas», «1 tambor». */
export const describeQuantity = (cargo: CargoType, quantity: number): string =>
  `${quantity} ${quantity === 1 ? CARGO[cargo].singular : CARGO[cargo].plural}`;

/** Lugar del asistente y del mapa (GET /places, GET /places/map). */
export interface Place {
  id: string;
  kind: 'apiary' | 'establishment';
  placeType: PlaceType;
  establishmentType: string;
  name: string;
  code: string | null;
  codeLabel: string | null;
  internalCode: string | null;
  locality: string | null;
  province: string | null;
  zoneId: string | null;
  zoneName: string | null;
  hiveCount: number | null;
  organizationId: string;
  organizationName: string | null;
  own: boolean;
  status: string;
  registryStatus: string | null;
  latitude: number | null;
  longitude: number | null;
  photoId: string | null;
  warning: string | null;
}

export interface PlacesMap {
  places: Place[];
  withoutLocation: { id: string; kind: 'apiary' | 'establishment'; placeType: PlaceType; name: string }[];
  counts: Record<string, number>;
}

/** Vehículo guardado (GET /vehicles). */
export interface Vehicle {
  id: string;
  organizationId: string | null;
  name: string | null;
  driverName: string | null;
  plate: string;
  trailerPlate: string | null;
  type: string | null;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export const VEHICLE_KINDS = ['CAMIONETA', 'CAMION', 'ACOPLADO', 'FURGON', 'UTILITARIO', 'OTRO'] as const;
export type VehicleKind = (typeof VEHICLE_KINDS)[number];

export const VEHICLE_LABELS: Record<VehicleKind, string> = {
  CAMIONETA: 'Camioneta',
  CAMION: 'Camión',
  ACOPLADO: 'Acoplado',
  FURGON: 'Furgón',
  UTILITARIO: 'Utilitario',
  OTRO: 'Otro',
};

/** Tipo de vehículo de un dato guardado (los anteriores al rediseño son texto libre). */
export const vehicleKind = (type: string | null | undefined): VehicleKind => {
  const value = (type ?? '').toUpperCase();
  if ((VEHICLE_KINDS as readonly string[]).includes(value)) return value as VehicleKind;
  if (/CAMIONETA/.test(value)) return 'CAMIONETA';
  if (/FURG/.test(value)) return 'FURGON';
  if (/ACOPLADO/.test(value)) return 'ACOPLADO';
  if (/CAMI/.test(value)) return 'CAMION';
  return 'OTRO';
};

/** «Camioneta Hilux» o, si no tiene nombre, el tipo. */
export const vehicleTitle = (vehicle: Pick<Vehicle, 'name' | 'type'>): string =>
  vehicle.name?.trim() || VEHICLE_LABELS[vehicleKind(vehicle.type)];

/** Zona del apicultor (GET /zones). */
export interface Zone {
  id: string;
  name: string;
  organizationId: string;
  apiaryCount: number;
  hiveCount: number;
  /** Fincas de polinización activas en la zona (doc 14). */
  fincaCount?: number;
  createdAt: string;
}

/** «AB123CD» → «AB 123 CD» para leer de un vistazo (solo formato Mercosur). */
export const prettyPlate = (plate: string | null | undefined): string => {
  if (!plate) return '';
  const value = plate.toUpperCase().replace(/[\s.-]/g, '');
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(value)) return `${value.slice(0, 2)} ${value.slice(2, 5)} ${value.slice(5)}`;
  if (/^[A-Z]{3}\d{3}$/.test(value)) return `${value.slice(0, 3)} ${value.slice(3)}`;
  return value;
};
