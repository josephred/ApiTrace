import {
  addDaysIso,
  daysBetweenIso,
  formatDay,
  normalizePlate,
  suggestDeclared,
  todayAr,
  transitLight,
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
