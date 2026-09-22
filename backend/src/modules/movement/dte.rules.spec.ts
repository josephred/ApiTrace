import {
  DTE_RULES,
  addDays,
  alertsFor,
  daysBetween,
  defaultExpiryDate,
  effectiveStatus,
  endOfArDay,
  isAptForTransit,
  isArgentinePlate,
  normalizePlate,
  startOfArDay,
  suggestDeclaredQuantity,
  timeTransition,
  toArDate,
  transitWindow,
  validateAnticipation,
  validateConfirmedQuantity,
  validateValidity,
} from './dte.rules';

/** Instante en hora argentina (UTC-3), para escribir los casos como los vive el usuario. */
const ar = (local: string): Date => new Date(`${local}-03:00`);

const dates = { loadDate: '2026-03-20', expiryDate: '2026-03-22' };

describe('dte.rules - fechas en hora argentina', () => {
  it('el dia argentino cambia a las 03:00 UTC', () => {
    expect(toArDate(new Date('2026-03-20T02:59:59.999Z'))).toBe('2026-03-19');
    expect(toArDate(new Date('2026-03-20T03:00:00.000Z'))).toBe('2026-03-20');
  });

  it('suma dias y cuenta dias calendario, cruzando meses y anios', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-20', -4)).toBe('2026-03-16');
    expect(daysBetween('2026-03-20', '2026-03-24')).toBe(4);
    expect(daysBetween('2026-03-24', '2026-03-20')).toBe(-4);
  });

  it('el dia empieza a las 00:00 y termina a las 23:59:59.999 de Argentina', () => {
    expect(startOfArDay('2026-03-20').toISOString()).toBe('2026-03-20T03:00:00.000Z');
    expect(endOfArDay('2026-03-22').toISOString()).toBe('2026-03-23T02:59:59.999Z');
  });
});

describe('dte.rules - ventana de transito y estado efectivo (seccion 5.1)', () => {
  it('calcula la ventana y el ultimo dia de cierre extemporaneo', () => {
    const window = transitWindow(dates);
    expect(window?.validFrom.toISOString()).toBe('2026-03-20T03:00:00.000Z');
    expect(window?.validTo.toISOString()).toBe('2026-03-23T02:59:59.999Z');
    expect(window?.lastClosingDate).toBe('2026-03-26');
  });

  it('EMITIDO antes de la carga, VIGENTE durante, VENCIDO en la gracia y CADUCADO despues', () => {
    expect(effectiveStatus('EMITIDO', dates, ar('2026-03-19T23:59:59'))).toBe('EMITIDO');
    expect(effectiveStatus('EMITIDO', dates, ar('2026-03-20T00:00:00'))).toBe('VIGENTE');
    expect(effectiveStatus('EMITIDO', dates, ar('2026-03-22T23:59:59'))).toBe('VIGENTE');
    expect(effectiveStatus('EMITIDO', dates, ar('2026-03-23T00:00:00'))).toBe('VENCIDO');
    expect(effectiveStatus('EMITIDO', dates, ar('2026-03-26T23:59:59'))).toBe('VENCIDO');
    expect(effectiveStatus('EMITIDO', dates, ar('2026-03-27T00:00:00'))).toBe('CADUCADO');
  });

  it('los estados que no dependen del reloj no cambian', () => {
    for (const status of [
      'BORRADOR',
      'SOLICITADO',
      'CERRADO',
      'ANULADO',
      'ELIMINADO',
      'SIN_ARRIBO',
    ]) {
      expect(effectiveStatus(status, dates, ar('2026-04-30T12:00:00'))).toBe(status);
    }
  });

  it('un documento sin fechas conserva su estado (remitos y DT-e anteriores a la migracion)', () => {
    expect(effectiveStatus('EMITIDO', { loadDate: null, expiryDate: null }, new Date())).toBe(
      'EMITIDO',
    );
  });

  it('el reloj solo empuja hacia adelante', () => {
    expect(timeTransition('EMITIDO', dates, ar('2026-03-21T10:00:00'))).toBe('VIGENTE');
    expect(timeTransition('VENCIDO', dates, ar('2026-03-21T10:00:00'))).toBeNull();
    expect(timeTransition('VIGENTE', dates, ar('2026-03-21T10:00:00'))).toBeNull();
    expect(timeTransition('CERRADO', dates, ar('2026-05-01T10:00:00'))).toBeNull();
  });

  it('solo VIGENTE habilita el transito (semaforo)', () => {
    expect(isAptForTransit('EMITIDO', dates, ar('2026-03-19T20:00:00'))).toBe(false);
    expect(isAptForTransit('EMITIDO', dates, ar('2026-03-20T06:00:00'))).toBe(true);
    expect(isAptForTransit('VIGENTE', dates, ar('2026-03-23T06:00:00'))).toBe(false);
  });
});

describe('dte.rules - validaciones del tramite (secciones 4.1 y 4.2)', () => {
  it('vencimiento por defecto a 2 dias y valido entre 2 y 4', () => {
    expect(defaultExpiryDate('2026-03-20')).toBe('2026-03-22');
    expect(validateValidity('2026-03-20', '2026-03-22')).toBeNull();
    expect(validateValidity('2026-03-20', '2026-03-24')).toBeNull();
    expect(validateValidity('2026-03-20', '2026-03-25')?.code).toBe('VIGENCIA_FUERA_DE_RANGO');
    expect(validateValidity('2026-03-20', '2026-03-21')?.code).toBe('VIGENCIA_FUERA_DE_RANGO');
  });

  it('la solicitud se admite hasta 4 dias antes de la carga y nunca para una fecha pasada', () => {
    const now = ar('2026-03-16T10:00:00');
    expect(validateAnticipation('2026-03-20', now)).toBeNull();
    expect(validateAnticipation('2026-03-16', now)).toBeNull();
    expect(validateAnticipation('2026-03-21', now)?.code).toBe('ANTICIPACION_EXCEDIDA');
    expect(validateAnticipation('2026-03-15', now)?.code).toBe('FECHA_CARGA_PASADA');
  });

  it('Qreal no puede superar Qdeclarada (seccion 5.2)', () => {
    expect(validateConfirmedQuantity(50, 50)).toBeNull();
    expect(validateConfirmedQuantity(50, 49)).toBeNull();
    const violation = validateConfirmedQuantity(50, 60);
    expect(violation?.code).toBe('EXCESO_CANTIDAD_DECLARADA');
    expect(violation?.message).toContain('60');
    expect(validateConfirmedQuantity(null, 999)).toBeNull();
  });

  it('sugiere sobreestimar lo declarado', () => {
    expect(suggestDeclaredQuantity(50)).toBe(Math.ceil(50 * DTE_RULES.overestimationFactor));
    expect(suggestDeclaredQuantity(1)).toBe(2);
  });

  it('normaliza y reconoce patentes argentinas', () => {
    expect(normalizePlate(' aa-123 bc ')).toBe('AA123BC');
    expect(normalizePlate('NO')).toBeNull();
    expect(normalizePlate('')).toBeNull();
    expect(isArgentinePlate('AA123BC')).toBe(true);
    expect(isArgentinePlate('ABC123')).toBe(true);
    expect(isArgentinePlate('A123BCD')).toBe(false);
  });
});

describe('dte.rules - avisos al usuario', () => {
  const base = {
    issueMode: 'MANUAL',
    syncStatus: 'PENDING_SYNC',
    errorMessage: null,
    regularizedAt: null,
  };

  it('avisa que un DT-e emitido todavia no habilita el transito', () => {
    const alerts = alertsFor({ ...base, ...dates, status: 'EMITIDO' }, ar('2026-03-19T10:00:00'));
    expect(alerts.map((alert) => alert.code)).toContain('NO_TRANSITAR');
  });

  it('avisa el vencimiento del dia', () => {
    const alerts = alertsFor({ ...base, ...dates, status: 'EMITIDO' }, ar('2026-03-22T10:00:00'));
    expect(alerts.map((alert) => alert.code)).toContain('VENCE_HOY');
  });

  it('marca la simulacion como sin validez oficial', () => {
    const alerts = alertsFor(
      { ...base, ...dates, status: 'EMITIDO', issueMode: 'SIMULADO' },
      ar('2026-03-21T10:00:00'),
    );
    expect(alerts[0].code).toBe('SIMULADO');
  });

  it('un caducado regularizado ya no alerta el bloqueo', () => {
    const now = ar('2026-04-10T10:00:00');
    expect(alertsFor({ ...base, ...dates, status: 'CADUCADO' }, now).map((a) => a.code)).toContain(
      'CADUCADO_BLOQUEO',
    );
    expect(
      alertsFor({ ...base, ...dates, status: 'CADUCADO', regularizedAt: new Date() }, now),
    ).toHaveLength(0);
  });
});
