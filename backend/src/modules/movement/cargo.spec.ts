import {
  CARGO_PROFILE,
  CARGO_TYPES,
  cargoOfMovement,
  describeQuantity,
  isApiSemRoute,
  placeTypeOfEstablishment,
  transitReasonFor,
} from './cargo';

describe('Vocabulario del tramite (cargo)', () => {
  it('traduce cada carga al modelo canonico del movimiento', () => {
    expect(CARGO_PROFILE.ALZAS).toMatchObject({
      movementType: 'MATERIAL_MELARIO',
      materialType: 'MATERIAL_MELARIO',
      unit: 'ALZA',
    });
    expect(CARGO_PROFILE.COLMENAS).toMatchObject({ movementType: 'MATERIAL_VIVO', unit: 'COLMENA' });
    expect(CARGO_PROFILE.TAMBORES).toMatchObject({ movementType: 'MIEL_A_GRANEL', unit: 'TAMBOR' });
    expect(CARGO_PROFILE.FRASCOS.movementType).toBe('PRODUCTO_FRACCIONADO');
    expect(CARGO_PROFILE.REINAS.materialType).toBe('REINA');
  });

  it('vuelve del modelo canonico a la carga sin adivinar', () => {
    for (const cargo of CARGO_TYPES) {
      const profile = CARGO_PROFILE[cargo];
      expect(
        cargoOfMovement({
          movementType: profile.movementType,
          materialType: profile.materialType,
          unit: profile.unit,
        }),
      ).toBe(cargo);
    }
    expect(cargoOfMovement({ movementType: 'OTRO', materialType: 'CERA', unit: 'KG' })).toBeNull();
    expect(
      cargoOfMovement({ cargoType: 'NUCLEOS', movementType: 'OTRO', materialType: 'OTRO', unit: 'KG' }),
    ).toBe('NUCLEOS');
  });

  it('ubica cada establecimiento en los tipos de lugar del asistente', () => {
    expect(placeTypeOfEstablishment('APIARIO_BASE')).toBe('APIARIO');
    expect(placeTypeOfEstablishment('FINCA_POLINIZACION')).toBe('FINCA_POLINIZACION');
    expect(placeTypeOfEstablishment('ACOPIO')).toBe('DEPOSITO');
    expect(placeTypeOfEstablishment('DEPOSITO')).toBe('DEPOSITO');
    expect(placeTypeOfEstablishment('FRACCIONADORA')).toBe('SALA_FRACCIONAMIENTO');
    expect(placeTypeOfEstablishment('LABORATORIO')).toBeNull();
  });

  it('solo alzas de apiario a sala de extraccion son API-SEM', () => {
    expect(isApiSemRoute('ALZAS', 'APIARIO', 'SALA_EXTRACCION')).toBe(true);
    expect(isApiSemRoute('ALZAS', 'APIARIO', 'DEPOSITO')).toBe(false);
    expect(isApiSemRoute('COLMENAS', 'APIARIO', 'SALA_EXTRACCION')).toBe(false);
    expect(isApiSemRoute('ALZAS', 'DEPOSITO', 'SALA_EXTRACCION')).toBe(false);
  });

  it('describe cantidades y motivos en castellano', () => {
    expect(describeQuantity('TAMBORES', 1)).toBe('1 tambor');
    expect(describeQuantity('ALZAS', 100)).toBe('100 alzas');
    expect(transitReasonFor('COLMENAS', 'FINCA_POLINIZACION')).toBe('Polinizacion');
    expect(transitReasonFor('TAMBORES', 'SALA_FRACCIONAMIENTO')).toBe('Fraccionamiento');
    expect(transitReasonFor('NUCLEOS', 'APIARIO')).toBe('Traslado de material vivo');
  });
});
