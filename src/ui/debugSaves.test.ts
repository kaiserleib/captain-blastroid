import { describe, expect, it } from 'vitest';
import { LEVEL_ORDER, UPGRADES, UPGRADE_ORDER } from '../content';
import { isLevelUnlocked, normalize } from '../meta';
import { debugSave } from './debugSaves';

describe('?save=act1', () => {
  const s = debugSave('act1');

  it('has Act I cleared and Act II open at Corona Drift', () => {
    for (const id of LEVEL_ORDER.slice(0, 5)) expect(s.levels[id]?.clears, id).toBe(1);
    for (const id of LEVEL_ORDER.slice(5)) expect(s.levels[id], id).toBeUndefined();
    expect(s.selectedLevel).toBe('corona');
    expect(isLevelUnlocked(s, 'corona')).toBe(true);
    expect(isLevelUnlocked(s, 'warrens')).toBe(false);
  });

  it('flies the Kestrel with Blastroid, everything Act I bought, no Act II weapons', () => {
    expect(s.selectedShip).toBe('kestrel');
    expect(s.selectedPilot).toBe('blastroid');
    expect(s.shipsBuilt).toEqual([
      'kestrel',
      'bulwark',
      'dart',
      'warden',
      'corsair',
      'halcyon',
      'paragon',
    ]);
    expect(s.pilotsRescued).toEqual([
      'blastroid',
      'juno',
      'grieg',
      'zzkar',
      'sable',
      'pip',
      'vale',
    ]);
    for (const u of UPGRADE_ORDER) expect(s.upgrades[u], u).toBe(UPGRADES[u]?.maxLevel);
    expect(s.weaponsUnlocked).toEqual(['blaster', 'spread', 'lance', 'seeker', 'orbitDrones']);
  });

  it('survives a save round trip unchanged', () => {
    expect(normalize(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});
