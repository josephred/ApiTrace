import { hubItems, hubItemsFor } from './hub';
import { cleanRenspa, renspaError } from './fincas';
import { noPlacesText } from './cargo';

describe('Carga de datos (doc 14)', () => {
  it('ofrece las cinco opciones en el orden de la captura de Rodrigo', () => {
    expect(hubItemsFor('PRODUCTOR').map((item, index) => `${index + 1}. ${item.title}`)).toEqual([
      '1. Apiario',
      '2. Finca / Polinización',
      '3. Sala de extracción',
      '4. Sala de fraccionamiento',
      '5. Traslados',
    ]);
  });

  it('lleva la finca a su lista, con su ícono y su bajada', () => {
    const finca = hubItems().find((item) => item.to === '/fincas');
    expect(finca).toMatchObject({
      icon: 'fieldPlus',
      title: 'Finca / Polinización',
      detail: 'Registro de fincas y polinización',
    });
  });

  it('cuenta los apiarios en la bajada cuando hay', () => {
    expect(hubItems(45)[0].detail).toBe('Cargá tus 45 apiarios por zona');
    expect(hubItems(0)[0].detail).toBe('Cargá tus apiarios por zona');
  });

  it('muestra la finca a quien carga apiarios, no a la sala ni a la transportista', () => {
    expect(hubItemsFor('AUDITOR').some((item) => item.to === '/fincas')).toBe(true);
    expect(hubItemsFor('ADMIN').some((item) => item.to === '/fincas')).toBe(true);
    expect(hubItemsFor('SALA').map((item) => item.title)).toEqual([
      'Sala de extracción',
      'Sala de fraccionamiento',
      'Traslados',
    ]);
    expect(hubItemsFor('TRANSPORTISTA').map((item) => item.title)).toEqual(['Traslados']);
    expect(hubItemsFor(undefined)).toEqual([]);
  });
});

describe('RENSPA del campo', () => {
  it('es opcional: vacío no es un error', () => {
    expect(renspaError('')).toBeNull();
    expect(renspaError('   ')).toBeNull();
  });

  it('acepta el formato con puntos y barra, y los espacios de los bordes', () => {
    expect(renspaError('01.002.0.00123/45')).toBeNull();
    expect(renspaError('  13.016.0.00218/00 ')).toBeNull();
    expect(cleanRenspa('  13.016.0.00218/00 ')).toBe('13.016.0.00218/00');
  });

  it('ataja lo que no es un RENSPA', () => {
    expect(renspaError('abc')).toMatch(/Revisá el RENSPA/);
    expect(renspaError('12')).toMatch(/Revisá el RENSPA/);
    expect(renspaError('01.002.0.00123/45x')).toMatch(/Revisá el RENSPA/);
  });
});

describe('pasos 4 y 5 sin lugares', () => {
  it('habla en plural y con el género de cada lugar', () => {
    expect(noPlacesText('FINCA_POLINIZACION', 'destination')).toBe(
      'No hay fincas de polinización registradas como destino.',
    );
    expect(noPlacesText('FINCA_POLINIZACION', 'origin')).toBe(
      'No tenés fincas de polinización registradas.',
    );
    expect(noPlacesText('SALA_EXTRACCION', 'destination')).toBe(
      'No hay salas de extracción registradas como destino.',
    );
    expect(noPlacesText('APIARIO', 'origin')).toBe('No tenés apiarios registrados.');
    expect(noPlacesText('DEPOSITO', 'destination')).toBe(
      'No hay depósitos registrados como destino.',
    );
  });
});
