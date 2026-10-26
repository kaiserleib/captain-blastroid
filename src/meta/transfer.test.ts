import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, SaveFormatError, createDefaultSave, type SaveData } from './schema';
import { checksum, decodeSaveCode, encodeSaveCode } from './transfer';

function sample(): SaveData {
  const s = createDefaultSave();
  s.salvage = 345;
  s.upgrades.capacitors = 3;
  s.schematics.push('bulwark');
  s.shipsBuilt.push('bulwark');
  s.pilotsRescued.push('juno');
  s.levels.kessler = { clears: 2, best: 18000 };
  s.highScores.push({ score: 18000, pilot: 'juno', ship: 'bulwark', level: 'kessler', date: 'd' });
  s.settings.music = 0.1;
  return s;
}

/** Builds a code around arbitrary JSON, the way an older build would have. */
function codeFor(json: string): string {
  const payload = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `CB1.${payload}.${checksum(payload)}`;
}

describe('save codes', () => {
  it('round-trips progress and keeps the device settings', () => {
    const save = sample();
    const device = { ...createDefaultSave().settings, music: 0.8 };
    const back = decodeSaveCode(encodeSaveCode(save), device);
    expect(back).toEqual({ ...save, settings: device });
  });

  it('is plain url-safe text with a version prefix', () => {
    const code = encodeSaveCode(sample());
    expect(code).toMatch(/^CB1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
    expect(code).not.toContain('music');
  });

  it('ignores line wraps and spaces from pasting', () => {
    const code = encodeSaveCode(sample());
    const wrapped = code.replace(/(.{40})/g, '$1\n  ');
    expect(decodeSaveCode(wrapped, createDefaultSave().settings).salvage).toBe(345);
  });

  it('refuses codes that are not ours, damaged or truncated', () => {
    const settings = createDefaultSave().settings;
    const code = encodeSaveCode(sample());
    const flip = code.slice(0, 20) + (code[20] === 'A' ? 'B' : 'A') + code.slice(21);
    const bad = [
      '',
      'hello',
      'CB9.' + code.slice(4),
      flip,
      code.slice(0, -1),
      code.slice(0, 30) + code.slice(-9),
      'CB1.!!!!.' + checksum('!!!!'),
    ];
    for (const c of bad) expect(() => decodeSaveCode(c, settings), c).toThrow(SaveFormatError);
  });

  it('refuses well-formed codes that do not hold a save', () => {
    const settings = createDefaultSave().settings;
    expect(() => decodeSaveCode(codeFor('{"salvage":5}'), settings)).toThrow(SaveFormatError);
    expect(() => decodeSaveCode(codeFor('[1,2]'), settings)).toThrow(SaveFormatError);
    expect(() => decodeSaveCode(codeFor('nope'), settings)).toThrow(SaveFormatError);
  });

  it('migrates a code exported from a v1 save', () => {
    const v1 = {
      version: 1,
      salvage: 50,
      shipsBuilt: ['kestrel'],
      pilotsRescued: ['blastroid', 'grieg'],
      highScores: [{ score: 700, pilot: 'grieg', ship: 'kestrel', date: '' }],
      stats: { runs: 3, kills: 10, deaths: 2, bossKills: 1 },
    };
    const s = decodeSaveCode(codeFor(JSON.stringify(v1)), createDefaultSave().settings);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.pilotsRescued).toEqual(['blastroid', 'grieg']);
    expect(s.levels).toEqual({ kessler: { clears: 1, best: 700 } });
  });
});
