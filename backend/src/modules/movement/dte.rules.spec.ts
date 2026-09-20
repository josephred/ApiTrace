import {
  addDaysIso,
  daysBetweenIso,
  DEFAULT_VALIDITY_DAYS,
  DteStatuses,
  getTransitSemaphore,
  isValidPlate,
  LAPSE_GRACE_DAYS,
  normalizePlate,
  suggestDeclaredQuantity,
} from './dte.rules';
import { presentDte } from './dte.presenter';
import { SimulatedSenasaGateway } from './senasa/simulated.gateway';

describe('DT-e Business Rules & Semaphore (SENASA 2026)', () => {
  describe('Normative constants', () => {
    it('has 2 days default validity and 4 days lapse grace according to SENASA 2026', () => {
      expect(DEFAULT_VALIDITY_DAYS).toBe(2);
      expect(LAPSE_GRACE_DAYS).toBe(4);
    });
  });

  describe('Plate validation', () => {
    it('validates Argentine Mercosur and classic plates correctly', () => {
      expect(isValidPlate('AF123CD')).toBe(true);
      expect(isValidPlate('ABC123')).toBe(true);
      expect(isValidPlate('101AA123BB')).toBe(true);
      expect(isValidPlate('INVALID')).toBe(false);
      expect(normalizePlate(' af 123 cd ')).toBe('AF123CD');
    });
  });

  describe('Quantity rules', () => {
    it('suggests declared quantity with +15% margin for honey alzas', () => {
      expect(suggestDeclaredQuantity(100)).toBe(115);
      expect(suggestDeclaredQuantity(50)).toBe(58);
      expect(suggestDeclaredQuantity(0)).toBe(0);
    });
  });

  describe('Date helpers', () => {
    it('correctly calculates day differences and addition', () => {
      expect(addDaysIso('2026-09-19', 2)).toBe('2026-09-21');
      expect(daysBetweenIso('2026-09-19', '2026-09-21')).toBe(2);
    });
  });

  describe('getTransitSemaphore', () => {
    const today = new Date('2026-09-19T12:00:00.000-03:00');

    it('returns ROJO and canTransit: false for BORRADOR and SOLICITADO', () => {
      const semBorrador = getTransitSemaphore({ status: DteStatuses.BORRADOR, now: today });
      expect(semBorrador.semaphore).toBe('ROJO');
      expect(semBorrador.canTransit).toBe(false);

      const semSolicitado = getTransitSemaphore({ status: DteStatuses.SOLICITADO, now: today });
      expect(semSolicitado.semaphore).toBe('ROJO');
      expect(semSolicitado.canTransit).toBe(false);
    });

    it('prohibits dispatch (ROJO) if DT-e is EMITIDO but loadDate is in the future', () => {
      const tomorrowStr = '2026-09-20';
      const sem = getTransitSemaphore({
        status: DteStatuses.EMITIDO,
        loadDate: tomorrowStr,
        expiryDate: '2026-09-22',
        now: today,
      });
      expect(sem.semaphore).toBe('ROJO');
      expect(sem.canTransit).toBe(false);
      expect(sem.reason).toContain('previo a la fecha autorizada de carga');
    });

    it('authorizes dispatch (VERDE) when EMITIDO or VIGENTE on valid loadDate', () => {
      const sem = getTransitSemaphore({
        status: DteStatuses.EMITIDO,
        loadDate: '2026-09-19',
        expiryDate: '2026-09-21',
        now: today,
      });
      expect(sem.semaphore).toBe('VERDE');
      expect(sem.canTransit).toBe(true);
    });

    it('warns in AMARILLO when close to expiration (< 18 hours left)', () => {
      const almostExpiredNow = new Date('2026-09-21T06:00:00.000-03:00');
      const sem = getTransitSemaphore({
        status: DteStatuses.VIGENTE,
        loadDate: '2026-09-19',
        expiryDate: '2026-09-21',
        now: almostExpiredNow,
      });
      expect(sem.semaphore).toBe('AMARILLO');
      expect(sem.canTransit).toBe(true);
    });

    it('returns ROJO for expired and caducado DT-e', () => {
      const afterExpiryNow = new Date('2026-09-22T12:00:00.000-03:00');
      const semVencido = getTransitSemaphore({
        status: DteStatuses.VIGENTE,
        loadDate: '2026-09-19',
        expiryDate: '2026-09-21',
        now: afterExpiryNow,
      });
      expect(semVencido.semaphore).toBe('ROJO');
      expect(semVencido.canTransit).toBe(false);

      const semCaducado = getTransitSemaphore({
        status: DteStatuses.CADUCADO,
        loadDate: '2026-09-19',
        expiryDate: '2026-09-21',
        now: afterExpiryNow,
      });
      expect(semCaducado.semaphore).toBe('ROJO');
      expect(semCaducado.canTransit).toBe(false);
    });

    it('returns AZUL for CERRADO and ROJO for ANULADO', () => {
      const semCerrado = getTransitSemaphore({ status: DteStatuses.CERRADO, now: today });
      expect(semCerrado.semaphore).toBe('AZUL');
      expect(semCerrado.canTransit).toBe(false);

      const semAnulado = getTransitSemaphore({ status: DteStatuses.ANULADO, now: today });
      expect(semAnulado.semaphore).toBe('ROJO');
      expect(semAnulado.canTransit).toBe(false);
    });
  });

  describe('SimulatedSenasaGateway', () => {
    it('generates clearly distinguishable simulated numbers starting with DTE-SIM-2026-', async () => {
      const gateway = new SimulatedSenasaGateway();
      const result = await gateway.requestDte({
        movementId: 'test-mov-123',
        originRenspa: '01.001.0.00001/00',
        destinationRenspa: '01.002.0.00002/00',
        holderTaxId: '20-12345678-9',
        loadDate: '2026-09-19',
        expiryDate: '2026-09-21',
        declaredQuantity: 100,
        unit: 'ALZA',
        transitReason: 'EXTRACCION',
        productCode: '24.45',
        productName: 'Miel a granel',
        transportType: 'PROPIO',
        transportPlate: 'AF123CD',
      });

      expect(result.number).toMatch(/^DTE-SIM-2026-\d{6}$/);
      expect(result.verificationCode).toMatch(/^VER-\d{4}$/);
      expect(result.externalId).toMatch(/^SIGSA-SIM-/);
      expect(result.status).toBe('EMITIDO');
    });
  });

  describe('presentDte', () => {
    it('cleans dates to YYYY-MM-DD and controls verification code visibility', () => {
      const sampleDte = {
        id: 'dte-1',
        issuerOrganizationId: 'org-issuer',
        destinationOrganizationId: 'org-dest',
        status: 'EMITIDO',
        loadDate: '2026-09-19 00:00:00+00',
        expiryDate: new Date('2026-09-21T00:00:00Z'),
        verificationCode: 'VER-9999',
      };

      // Recipient cannot see verification code before arrival/closure
      const presentedForDest = presentDte(sampleDte, {
        userRole: 'SALA',
        userOrgId: 'org-dest',
      });
      expect(presentedForDest.loadDate).toBe('2026-09-19');
      expect(presentedForDest.expiryDate).toBe('2026-09-21');
      expect(presentedForDest.verificationCode).toBeNull();
      expect(presentedForDest.canSeeVerificationCode).toBe(false);

      // Issuer can see verification code to print on physical DT-e
      const presentedForIssuer = presentDte(sampleDte, {
        userRole: 'PRODUCTOR',
        userOrgId: 'org-issuer',
      });
      expect(presentedForIssuer.verificationCode).toBe('VER-9999');
      expect(presentedForIssuer.canSeeVerificationCode).toBe(true);
    });
  });
});
