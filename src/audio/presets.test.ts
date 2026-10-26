import { describe, expect, it } from 'vitest';
import { presetDuration, SFX, SFX_IDS, type SfxPreset } from './presets';

// The contract other tickets emit via world.events 'sfx'.
const CONTRACT_IDS = [
  'shot_blaster',
  'shot_spread',
  'shot_lance',
  'shot_seeker',
  'drone_hit',
  'enemy_hit',
  'enemy_die_s',
  'enemy_die_m',
  'asteroid_break',
  'player_hit',
  'player_die',
  'shield_up',
  'pickup',
  'weapon_up',
  'magnet_on',
  'repulsor_on',
  'pod_rescue',
  'boss_warning',
  'boss_die',
  'ui_move',
  'ui_confirm',
  'ui_back',
];

const presets = SFX as Record<string, SfxPreset>;
const peak = (p: SfxPreset) => Math.max(...p.map((v) => v.vol));

describe('sfx presets', () => {
  it('cover exactly the contract ids', () => {
    expect([...SFX_IDS].sort()).toEqual([...CONTRACT_IDS].sort());
  });

  it('keep player shots quiet and short relative to hits and explosions', () => {
    for (const id of ['shot_blaster', 'shot_spread', 'shot_lance', 'shot_seeker']) {
      expect(peak(presets[id]!)).toBeLessThanOrEqual(0.12);
      expect(presetDuration(presets[id]!)).toBeLessThan(0.15);
    }
    for (const id of ['enemy_hit', 'enemy_die_s', 'enemy_die_m', 'asteroid_break', 'boss_die']) {
      expect(peak(presets[id]!)).toBeGreaterThanOrEqual(0.25);
    }
  });

  it('have finite, bounded durations', () => {
    for (const id of SFX_IDS) {
      const d = presetDuration(presets[id]!);
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(2.5);
    }
  });

  it('never slide to a zero pitch or cutoff (exponential ramps need > 0)', () => {
    for (const id of SFX_IDS) {
      for (const v of presets[id]!) {
        expect(v.freq).toBeGreaterThan(0);
        if (v.freqEnd !== undefined) expect(v.freqEnd).toBeGreaterThan(0);
        if (v.lowpassEnd !== undefined) expect(v.lowpassEnd).toBeGreaterThan(0);
      }
    }
  });
});

describe('presetDuration', () => {
  it('accounts for delay and repeats', () => {
    expect(
      presetDuration([{ wave: 'square', freq: 100, decay: 0.1, release: 0, delay: 0.2, vol: 1 }]),
    ).toBeCloseTo(0.3);
    expect(
      presetDuration([
        { wave: 'noise', freq: 1, decay: 0.1, release: 0, repeat: 3, repeatRate: 0.05, vol: 1 },
      ]),
    ).toBeCloseTo(0.2);
  });
});
