import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SAVE_VERSION,
  SaveFormatError,
  createDefaultSave,
  migrate,
  parseSave,
  serializeSave,
} from './schema';

describe('save schema', () => {
  it('defaults unlock only Kestrel and Captain Blastroid', () => {
    const s = createDefaultSave();
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.shipsBuilt).toEqual(['kestrel']);
    expect(s.pilotsRescued).toEqual(['blastroid']);
    expect(s.selectedShip).toBe('kestrel');
    expect(s.selectedPilot).toBe('blastroid');
    expect(s.salvage).toBe(0);
    expect(s.highScores).toEqual([]);
    expect(s.settings.stickOpacity).toBe(0.5);
    expect(s.settings.stickRadiusScale).toBe(1);
  });

  it('defaults are independent copies', () => {
    const a = createDefaultSave();
    a.settings.music = 0;
    a.shipsBuilt.push('dart');
    expect(createDefaultSave().settings.music).toBe(DEFAULT_SETTINGS.music);
    expect(createDefaultSave().shipsBuilt).toEqual(['kestrel']);
  });

  it('round-trips through JSON', () => {
    const s = createDefaultSave();
    s.salvage = 123;
    s.upgrades.capacitors = 2;
    s.schematics.push('bulwark');
    s.highScores.push({
      score: 500,
      pilot: 'blastroid',
      ship: 'kestrel',
      level: 'kessler',
      date: 'x',
    });
    expect(parseSave(serializeSave(s))).toEqual(s);
  });

  it('rejects non-JSON and non-save data', () => {
    expect(() => parseSave('{oops')).toThrow(SaveFormatError);
    expect(() => parseSave('[]')).toThrow(SaveFormatError);
    expect(() => parseSave('{"salvage":5}')).toThrow(SaveFormatError);
  });

  it('migrate repairs bad fields and keeps starter unlocks', () => {
    const s = migrate({
      version: 1,
      salvage: -5,
      upgrades: { capacitors: 99, bogus: 3, tractor: 'x' },
      shipsBuilt: ['dart', 'nope', 'dart'],
      pilotsRescued: [],
      selectedShip: 'bulwark',
      selectedPilot: 'juno',
      settings: { music: 4, screenShake: 'wild', stickOpacity: 0.2 },
    });
    expect(s.salvage).toBe(0);
    expect(s.upgrades).toEqual({ capacitors: 5 });
    expect(s.shipsBuilt).toEqual(['kestrel', 'dart']);
    expect(s.pilotsRescued).toEqual(['blastroid']);
    expect(s.selectedShip).toBe('kestrel');
    expect(s.selectedPilot).toBe('blastroid');
    expect(s.settings.music).toBe(1);
    expect(s.settings.screenShake).toBe('full');
    expect(s.settings.stickOpacity).toBe(0.2);
  });

  it('caps and sorts high scores', () => {
    const highScores = Array.from({ length: 15 }, (_, i) => ({
      score: i * 10,
      pilot: 'blastroid',
      ship: 'kestrel',
      date: '',
    }));
    const s = migrate({ version: 1, highScores });
    expect(s.highScores).toHaveLength(10);
    expect(s.highScores[0]?.score).toBe(140);
  });

  it('caps high scores per level, keeping one sorted array', () => {
    const entry = (score: number, level: string) => ({
      score,
      level,
      pilot: 'blastroid',
      ship: 'kestrel',
      date: '',
    });
    const highScores = [
      ...Array.from({ length: 12 }, (_, i) => entry(1000 + i * 10, 'kessler')),
      ...Array.from({ length: 3 }, (_, i) => entry(1005 + i * 10, 'ionShoals')),
    ];
    const s = migrate({ ...createDefaultSave(), highScores });
    expect(s.highScores.filter((h) => h.level === 'kessler')).toHaveLength(10);
    expect(s.highScores.filter((h) => h.level === 'ionShoals')).toHaveLength(3);
    const scores = s.highScores.map((h) => h.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(s.highScores.at(-1)?.score).toBe(1005);
  });

  // Verbatim shape of a save written by the v1 build that shipped with Level 1.
  const V1_SAVE = JSON.stringify({
    version: 1,
    salvage: 180,
    totalSalvageEarned: 420,
    upgrades: { capacitors: 2, tractor: 1 },
    schematics: ['bulwark', 'dart'],
    shipsBuilt: ['kestrel', 'bulwark'],
    pilotsRescued: ['blastroid', 'juno'],
    selectedShip: 'bulwark',
    selectedPilot: 'juno',
    highScores: [
      { score: 9120, pilot: 'blastroid', ship: 'kestrel', date: '2026-10-20T12:00:00.000Z' },
      { score: 18450, pilot: 'juno', ship: 'bulwark', date: '2026-10-21T12:00:00.000Z' },
    ],
    stats: { runs: 5, kills: 612, deaths: 4, bossKills: 2 },
    settings: {
      music: 0.2,
      sfx: 0.9,
      haptics: false,
      stickOpacity: 0.5,
      stickRadiusScale: 1.2,
      screenShake: 'low',
    },
  });

  it('migrates a v1 save to the current version without losing progress', () => {
    const s = parseSave(V1_SAVE);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.salvage).toBe(180);
    expect(s.upgrades).toEqual({ capacitors: 2, tractor: 1 });
    expect(s.shipsBuilt).toEqual(['kestrel', 'bulwark']);
    expect(s.selectedShip).toBe('bulwark');
    expect(s.selectedPilot).toBe('juno');
    expect(s.settings.haptics).toBe(false);
    expect(s.settings.screenShake).toBe('low');
    // Level 1 was the only level, so its clears and best score come from v1 totals.
    expect(s.selectedLevel).toBe('kessler');
    expect(s.levels).toEqual({ kessler: { clears: 2, best: 18450 } });
    expect(s.highScores.map((h) => [h.score, h.level])).toEqual([
      [18450, 'kessler'],
      [9120, 'kessler'],
    ]);
    // Re-saving and re-reading is stable.
    expect(parseSave(serializeSave(s))).toEqual(s);
  });

  it('migrates a fresh v1 save to empty level progress', () => {
    const s = migrate({ ...createDefaultSave(), version: 1, levels: undefined });
    expect(s.levels).toEqual({});
    expect(s.selectedLevel).toBe('kessler');
  });

  it('keeps level records for unknown levels but resets an unknown selected level', () => {
    const s = migrate({
      version: SAVE_VERSION,
      selectedLevel: 'nowhere',
      levels: { kessler: { clears: 1, best: 5 }, future: { clears: 3, best: 9 }, bad: 'x' },
    });
    expect(s.selectedLevel).toBe('kessler');
    expect(s.levels).toEqual({ kessler: { clears: 1, best: 5 }, future: { clears: 3, best: 9 } });
  });
});
