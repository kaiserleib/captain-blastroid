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
    s.highScores.push({ score: 500, pilot: 'blastroid', ship: 'kestrel', date: 'x' });
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
});
