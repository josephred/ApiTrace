import {
  addDaysIso,
  daysBetweenIso,
  formatDay,
  loadDateShortcuts,
  normalizePlate,
  suggestDeclared,
  todayAr,
  transitLight,
  validityOptions,
  validityWindow,
} from './dte';

describe('ayudas del DT-e', () => {
  it('sugiere sobreestimar las alzas declaradas', () => {
    expect(suggestDeclared(50)).toBe(75);
    expect(suggestDeclared(1)).toBe(2);
  });

  it('calcula el dia argentino: antes de las 03:00 UTC sigue siendo el dia anterior', () => {
    expect(todayAr(new Date('2026-09-21T02:30:00Z'))).toBe('2026-09-20');
    expect(todayAr(new Date('2026-09-21T03:30:00Z'))).toBe('2026-09-21');
  });

  it('suma y cuenta dias de calendario', () => {
    expect(addDaysIso('2026-09-29', 2)).toBe('2026-10-01');
    expect(daysBetweenIso('2026-09-21', '2026-09-25')).toBe(4);
  });

  it('muestra una fecha de calendario sin correrla por la zona horaria', () => {
    expect(formatDay('2026-09-21')).toBe('21/09/2026');
    expect(formatDay(null)).toBe('—');
  });

  it('el semaforo solo da verde a un DT-e vigente', () => {
    expect(
      transitLight({ status: 'VIGENTE', loadDate: '2026-09-21', expiryDate: '2026-09-23' }).tone,
    ).toBe('success');
    expect(
      transitLight({ status: 'EMITIDO', loadDate: '2026-09-21', expiryDate: '2026-09-23' }).tone,
    ).toBe('warning');
    expect(
      transitLight({ status: 'VENCIDO', loadDate: '2026-09-21', expiryDate: '2026-09-23' }).tone,
    ).toBe('danger');
  });

  it('normaliza patentes', () => {
    expect(normalizePlate(' aa-123 bc')).toBe('AA123BC');
  });
});

describe('vigencia en lenguaje de campo', () => {
  // 21/09/2026 a las 15:00 en Argentina.
  const tarde = new Date('2026-09-21T18:00:00Z');

  it('dice cuanto falta y avanza entre la carga y el vencimiento', () => {
    const window = validityWindow('2026-09-21', '2026-09-23', tarde)!;
    expect(window.label).toBe('Quedan 2 días');
    expect(window.tone).toBe('success');
    expect(window.progress).toBeGreaterThan(0.2);
    expect(window.progress).toBeLessThan(0.3);
  });

  it('avisa el ultimo dia y el anterior', () => {
    expect(validityWindow('2026-09-19', '2026-09-21', tarde)!.label).toBe('Vence hoy a las 23:59');
    expect(validityWindow('2026-09-19', '2026-09-21', tarde)!.tone).toBe('warning');
    expect(validityWindow('2026-09-20', '2026-09-22', tarde)!.label).toBe('Vence mañana a las 23:59');
  });

  it('antes de la carga no avanza; despues del vencimiento queda llena', () => {
    const antes = validityWindow('2026-09-22', '2026-09-24', tarde)!;
    expect(antes.progress).toBe(0);
    expect(antes.label).toBe('Se habilita mañana a las 00:00');
    const despues = validityWindow('2026-09-17', '2026-09-19', tarde)!;
    expect(despues.progress).toBe(1);
    expect(despues.tone).toBe('danger');
  });

  it('el dia de vencimiento termina a las 23:59 de Argentina, no de UTC', () => {
    // 23/09 a las 23:30 en Argentina ya es 24/09 en UTC: sigue vigente.
    const noche = new Date('2026-09-24T02:30:00Z');
    expect(validityWindow('2026-09-21', '2026-09-23', noche)!.label).toBe('Vence hoy a las 23:59');
  });

  it('ofrece atajos de carga y vigencias dentro de la norma', () => {
    expect(loadDateShortcuts('2026-09-21').map((option) => option.value)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
    ]);
    expect(validityOptions()).toEqual([2, 3, 4]);
  });
});
