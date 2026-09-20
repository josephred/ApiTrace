import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  daysBetweenIso,
  formatDay,
  getTransitSemaphore,
  isValidPlate,
  normalizePlate,
  suggestDeclaredQuantity,
  todayAr,
} from './dte';

describe('DTE Business Rules & Utilities', () => {
  it('calculates calendar day arithmetic in ISO strings correctly', () => {
    expect(addDaysIso('2026-03-20', 3)).toBe('2026-03-23');
    expect(addDaysIso('2026-03-31', 1)).toBe('2026-04-01');
    expect(daysBetweenIso('2026-03-20', '2026-03-23')).toBe(3);
  });

  it('formats dates for Argentine display DD/MM/YYYY', () => {
    expect(formatDay('2026-03-20')).toBe('20/03/2026');
    expect(formatDay('2026-11-12T09:00:00Z')).toBe('12/11/2026');
    expect(formatDay('2026-09-19 00:00:00+00')).toBe('19/09/2026');
  });

  it('normalizes and validates Argentine license plates', () => {
    expect(normalizePlate(' af 123 cd ')).toBe('AF123CD');
    expect(isValidPlate('AF123CD')).toBe(true); // Mercosur
    expect(isValidPlate('ABC123')).toBe(true); // Clasico
    expect(isValidPlate('101AA123BB')).toBe(true); // Acoplado trailer
    expect(isValidPlate('INVALID9999')).toBe(false);
  });

  it('suggests declared quantity with +15% overestimation for honey supers', () => {
    expect(suggestDeclaredQuantity(100)).toBe(115);
    expect(suggestDeclaredQuantity(50)).toBe(58);
  });

  it('evaluates transit semaphore accurately', () => {
    const today = todayAr();
    const futureLoad = addDaysIso(today, 2);
    const tomorrow = addDaysIso(today, 1);
    const yesterday = addDaysIso(today, -1);

    // Closed DT-e
    expect(getTransitSemaphore({ status: 'CERRADO' }).semaphore).toBe('AZUL');

    // Future load
    expect(
      getTransitSemaphore({
        status: 'EMITIDO',
        loadDate: futureLoad,
        expiryDate: addDaysIso(futureLoad, 3),
      }).semaphore,
    ).toBe('ROJO');

    // Active load within dates
    expect(
      getTransitSemaphore({
        status: 'VIGENTE',
        loadDate: yesterday,
        expiryDate: tomorrow,
      }).semaphore,
    ).toBe('VERDE');

    // Expiring today
    expect(
      getTransitSemaphore({
        status: 'VIGENTE',
        loadDate: yesterday,
        expiryDate: today,
      }).semaphore,
    ).toBe('AMARILLO');

    // Expired
    expect(
      getTransitSemaphore({
        status: 'VIGENTE',
        loadDate: addDaysIso(yesterday, -5),
        expiryDate: yesterday,
      }).semaphore,
    ).toBe('ROJO');
  });
});
