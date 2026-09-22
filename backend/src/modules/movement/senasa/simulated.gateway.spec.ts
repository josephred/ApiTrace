import { SenasaBusinessError } from './senasa.gateway';
import { SimulatedSenasaGateway } from './simulated.gateway';

const request = {
  externalReference: '8f3c2c55-0b7e-4a57-a1a4-5d7f3c7a9b10',
  holderTaxId: '20301112223',
  movementTypeCode: 'API-SEM',
  transitReason: 'Extracción de miel',
  originCode: 'B53999-2',
  destinationCode: 'SEF-B-20010',
  productCode: '24.45',
  unit: 'UNIDAD',
  declaredQuantity: 80,
  loadDate: '2026-03-20',
  expiryDate: '2026-03-22',
  transport: { type: 'CAMIONETA', plate: 'AA123BC', trailerPlate: null },
  localRegistry: { originStatus: 'ACTIVE', destinationStatus: 'ACTIVE' },
};

describe('SimulatedSenasaGateway', () => {
  const gateway = new SimulatedSenasaGateway();

  it('emite con prefijo SIM- y codigo de cierre de 6 digitos', async () => {
    const result = await gateway.emitDte(request);
    expect(result.number).toMatch(/^SIM-\d{9}-\d$/);
    expect(result.verificationCode).toMatch(/^\d{6}$/);
    expect(result.externalStatus).toBe('EMITIDO');
  });

  it('es idempotente: la misma referencia produce el mismo numero', async () => {
    const first = await gateway.emitDte(request);
    const second = await gateway.emitDte(request);
    expect(second.number).toBe(first.number);
    expect(second.verificationCode).toBe(first.verificationCode);
  });

  it('reproduce los rechazos de SIGSA por origen o destino inhabilitado', async () => {
    await expect(
      gateway.emitDte({
        ...request,
        localRegistry: { originStatus: 'SUSPENDED', destinationStatus: 'ACTIVE' },
      }),
    ).rejects.toMatchObject({ code: 'ORIGEN_NO_HABILITADO' });
    await expect(
      gateway.emitDte({
        ...request,
        localRegistry: { originStatus: 'ACTIVE', destinationStatus: 'EXPIRED' },
      }),
    ).rejects.toBeInstanceOf(SenasaBusinessError);
    await expect(gateway.emitDte({ ...request, holderTaxId: null })).rejects.toMatchObject({
      code: 'TITULAR_SIN_CUIT',
    });
  });

  it('no opera sobre numeros que no emitio', async () => {
    await expect(
      gateway.closeDte({
        number: '022440451-4',
        verificationCode: '1',
        arrivalAt: new Date(),
        confirmedQuantity: 1,
      }),
    ).rejects.toMatchObject({ code: 'NO_SIMULADO' });
  });
});
