import { DteLifecycleService } from './dte-lifecycle.service';
import type { DteRow } from './dte.queries';

const ar = (local: string): Date => new Date(`${local}-03:00`);

const row = (overrides: Partial<DteRow> = {}): DteRow =>
  ({
    id: 'dte-1',
    movementId: 'mov-1',
    number: '022440451-4',
    status: 'EMITIDO',
    loadDate: '2026-03-20',
    expiryDate: '2026-03-22',
    createdAt: ar('2026-03-17T09:00:00'),
    ...overrides,
  }) as DteRow;

describe('DteLifecycleService.stepsFor', () => {
  // stepsFor es puro: no usa la base ni el outbox.
  const service = new DteLifecycleService(
    null as never,
    null as never,
    null as never,
    null as never,
  );

  it('registra cada paso con el instante en que ocurrio, no con la hora del barrido', () => {
    const steps = service.stepsFor(row(), ar('2026-03-28T10:00:00'));
    expect(steps.map((step) => step.to)).toEqual(['VIGENTE', 'VENCIDO', 'CADUCADO']);
    expect(steps[0].at.toISOString()).toBe('2026-03-20T03:00:00.000Z');
    expect(steps[1].at.toISOString()).toBe('2026-03-23T03:00:00.000Z');
    expect(steps[2].at.toISOString()).toBe('2026-03-27T03:00:00.000Z');
  });

  it('no inventa pasos anteriores al alta del documento', () => {
    const late = row({ createdAt: ar('2026-03-21T15:00:00') });
    const [first] = service.stepsFor(late, ar('2026-03-21T16:00:00'));
    expect(first.to).toBe('VIGENTE');
    expect(first.at.getTime()).toBeGreaterThan(late.createdAt.getTime());
  });

  it('ubica los pasos despues del ultimo cambio registrado', () => {
    const issuedLate = ar('2026-03-21T10:00:00');
    const [first] = service.stepsFor(row(), ar('2026-03-21T11:00:00'), issuedLate);
    expect(first.to).toBe('VIGENTE');
    expect(first.at.getTime()).toBe(issuedLate.getTime() + 1);
  });

  it('no hace nada si el estado ya esta al dia o es terminal', () => {
    expect(service.stepsFor(row({ status: 'VIGENTE' }), ar('2026-03-21T10:00:00'))).toEqual([]);
    expect(service.stepsFor(row({ status: 'CERRADO' }), ar('2026-04-21T10:00:00'))).toEqual([]);
    expect(
      service.stepsFor(row({ loadDate: null, expiryDate: null }), ar('2026-04-21T10:00:00')),
    ).toEqual([]);
  });
});
