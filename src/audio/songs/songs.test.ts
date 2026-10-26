import { describe, expect, it } from 'vitest';
import { DRUMS } from '../notes';
import { advanceCursor, CHANNELS, compileSong, type SongCursor } from '../song';
import { SONGS } from './index';
import { estimateLoudness } from './loudness';
import { PULSAR_SONG_PERIOD } from './pulsar';

const SECTOR_SONGS = ['ion', 'horizon', 'pulsar', 'armada', 'armada_boss'] as const;
const level1 = SONGS.level1!;

describe('sector songs', () => {
  it('are registered under the ids the level defs use', () => {
    for (const id of SECTOR_SONGS) expect(SONGS[id]?.id).toBe(id);
  });

  it('have the design tempos', () => {
    expect(SONGS.ion!.bpm).toBe(128);
    expect(SONGS.horizon!.bpm).toBe(100);
    expect(SONGS.pulsar!.bpm).toBe(120);
    expect(SONGS.armada!.bpm).toBe(132);
    expect(SONGS.armada_boss!.bpm).toBeGreaterThan(SONGS.armada!.bpm);
    expect(SONGS.armada_boss!.bpm).toBeGreaterThan(SONGS.boss!.bpm);
  });

  it.each(SECTOR_SONGS)('%s loops, with at least 32 bars (128 beats) per loop', (id) => {
    const s = compileSong(SONGS[id]!);
    expect(s.loop).toBeGreaterThanOrEqual(0);
    const beats = s.loopSeconds / (60 / s.def.bpm);
    expect(beats).toBeGreaterThanOrEqual(128);
    // Whole bars only, so the loop seam lands on a downbeat.
    expect(beats % 4).toBe(0);
  });

  it.each(SECTOR_SONGS)('%s is mixed no hotter than level1', (id) => {
    const def = SONGS[id]!;
    for (const ch of CHANNELS) expect(def[ch].vol).toBeLessThanOrEqual(level1[ch].vol);
    expect(def.drums).toBeLessThanOrEqual(level1.drums);
    const ref = estimateLoudness(level1);
    const l = estimateLoudness(def);
    expect(l.rms).toBeLessThanOrEqual(ref.rms);
    expect(l.peak).toBeLessThanOrEqual(ref.peak);
  });

  // The user found the music too loud; boss used to estimate ~26% over level1.
  it('boss is no louder than level1', () => {
    const ref = estimateLoudness(level1);
    const l = estimateLoudness(SONGS.boss!);
    expect(l.rms).toBeLessThanOrEqual(ref.rms);
    expect(l.peak).toBeLessThanOrEqual(ref.peak);
  });

  it('loudness estimate ranks a denser mix louder', () => {
    const loud = { ...level1, drums: 1, p1: { ...level1.p1, vol: 0.3 } };
    expect(estimateLoudness(loud).rms).toBeGreaterThan(estimateLoudness(level1).rms);
  });
});

describe('pulsar phase lock', () => {
  it('kicks exactly every 3.0 s of song time, across two loops', () => {
    const s = compileSong(SONGS.pulsar!);
    expect(s.stepDur * 24).toBeCloseTo(PULSAR_SONG_PERIOD, 9);
    for (const e of s.entries) expect(e.pattern.steps % 24).toBe(0);
    const c: SongCursor = { entry: 0, step: 0, done: false };
    const kicks: number[] = [];
    const total = s.totalSteps + (s.totalSteps - 48);
    for (let n = 0; n < total; n++) {
      const hit = s.entries[c.entry]!.pattern.noise?.[c.step] ?? -1;
      if (hit === DRUMS.k) kicks.push(n * s.stepDur);
      advanceCursor(s, c);
    }
    expect(kicks.length).toBe(total / 24);
    kicks.forEach((t, k) => expect(t).toBeCloseTo(PULSAR_SONG_PERIOD * k, 9));
  });
});
