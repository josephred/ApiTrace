import {
  clearDteDraft,
  isMeaningfulDraft,
  loadDteDraft,
  loadRecentPicks,
  saveDteDraft,
  saveRecentPicks,
} from './dteDraft';
import { wipeLocalData } from './db';

describe('DT-e a medio armar', () => {
  beforeEach(async () => {
    await wipeLocalData();
  });

  it('guarda y recupera el paso y los valores de cada usuario por separado', async () => {
    await saveDteDraft({
      userId: 'u1',
      step: 2,
      values: { apiaryId: 'a1', declaredQuantity: '60' },
      context: null,
    });

    const draft = await loadDteDraft('u1');
    expect(draft?.step).toBe(2);
    expect(draft?.values.declaredQuantity).toBe('60');
    expect(draft?.savedAt).toBeGreaterThan(0);
    expect(await loadDteDraft('u2')).toBeNull();
  });

  it('avisa a las pantallas abiertas cuando cambia', async () => {
    const heard = vi.fn();
    window.addEventListener('apitrace:dte-draft', heard);
    await saveDteDraft({ userId: 'u1', step: 0, values: { apiaryId: 'a1' }, context: null });
    await clearDteDraft('u1');
    window.removeEventListener('apitrace:dte-draft', heard);
    expect(heard).toHaveBeenCalledTimes(2);
    expect(await loadDteDraft('u1')).toBeNull();
  });

  it('se borra al cerrar sesion junto con el resto de lo local', async () => {
    await saveDteDraft({ userId: 'u1', step: 1, values: { apiaryId: 'a1' }, context: null });
    await saveRecentPicks('u1', { apiaryId: 'a1' });
    await wipeLocalData();
    expect(await loadDteDraft('u1')).toBeNull();
    expect(await loadRecentPicks('u1')).toEqual({});
  });

  it('solo ofrece retomar si se eligio o cargo algo', () => {
    expect(isMeaningfulDraft({ transportPlate: 'AA123BC', loadDate: '2026-09-21' }, null)).toBe(false);
    expect(isMeaningfulDraft({ apiaryId: 'a1' }, null)).toBe(true);
    expect(
      isMeaningfulDraft(
        {},
        { movementId: 'm1', movementCode: 'MOV-1', origin: 'A', destination: 'S', replaces: null },
      ),
    ).toBe(true);
  });

  it('recuerda el ultimo apiario y la ultima sala usados', async () => {
    await saveRecentPicks('u1', { apiaryId: 'a2', destinationEstablishmentId: 's1' });
    expect(await loadRecentPicks('u1')).toEqual({ apiaryId: 'a2', destinationEstablishmentId: 's1' });
  });
});
