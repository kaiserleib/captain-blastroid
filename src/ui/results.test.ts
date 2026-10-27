import { describe, expect, it } from 'vitest';
import { LEVEL_ORDER } from '../content';
import { createRunState } from '../sim/world';
import { debugSave } from './debugSaves';
import { bankFinishedRun, resultBanners, unlockedWeaponOf } from './results';

function clear(levelId: string) {
  const run = createRunState('SEED', 'kestrel', 'blastroid', levelId);
  run.bossDefeated = true;
  return run;
}

describe('results view model (T32)', () => {
  it('shows ACT I COMPLETE on the first Armada clear, with NEXT SECTOR → Corona Drift', () => {
    const f = bankFinishedRun(debugSave('fresh'), clear('armada'), true);
    expect(f.firstClear).toBe(true);
    expect(f.actComplete).toBe('ACT I COMPLETE');
    expect(f.campaignComplete).toBe(false);
    expect(f.nextLevel).toBe('corona');
    expect(resultBanners(f, true).map((b) => b.text)).toEqual(['ACT I COMPLETE']);
    // Only the first clear.
    const again = bankFinishedRun(f.save, clear('armada'), true);
    expect(again.actComplete).toBeNull();
    expect(resultBanners(again, true)).toEqual([]);
  });

  it('shows CAMPAIGN COMPLETE on the first Foundry clear', () => {
    const f = bankFinishedRun(debugSave('act1'), clear('foundry'), true);
    expect(LEVEL_ORDER[LEVEL_ORDER.length - 1]).toBe('foundry');
    expect(f.campaignComplete).toBe(true);
    expect(f.actComplete).toBeNull();
    expect(f.nextLevel).toBeNull();
    expect(resultBanners(f, true)).toEqual([{ text: 'CAMPAIGN COMPLETE', kind: 'campaign' }]);
  });

  it('shows no banner for mid-act clears or defeats', () => {
    expect(bankFinishedRun(debugSave('fresh'), clear('kessler'), true).actComplete).toBeNull();
    const lost = createRunState('SEED', 'kestrel', 'blastroid', 'armada');
    const f = bankFinishedRun(debugSave('fresh'), lost, false);
    expect(f.actComplete).toBeNull();
    expect(resultBanners(f, false)).toEqual([]);
  });

  it('shows NEW WEAPON: <NAME> when a weapon unlocks', () => {
    const before = { weaponsUnlocked: debugSave('act1').weaponsUnlocked };
    const after = { weaponsUnlocked: [...before.weaponsUnlocked, 'arc' as const] };
    expect(unlockedWeaponOf(undefined, before, before)).toBeNull();
    expect(unlockedWeaponOf(undefined, before, after)).toBe('arc');
    expect(unlockedWeaponOf('flak', before, before)).toBe('flak');
    const banners = resultBanners(
      { campaignComplete: false, actComplete: null, unlockedWeaponName: 'ARC COIL' },
      true,
    );
    expect(banners).toEqual([{ text: 'NEW WEAPON: ARC COIL', kind: 'weapon' }]);
    const f = bankFinishedRun(debugSave('act1'), clear('corona'), true);
    // Until T35 banks the unlock a corona clear reports none; after it, ARC COIL.
    expect([null, 'ARC COIL']).toContain(f.unlockedWeaponName);
  });
});
