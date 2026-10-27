import { describe, expect, it } from 'vitest';
import { DRUMS } from '../notes';
import { advanceCursor, CHANNELS, compileSong, type SongCursor } from '../song';
import { SONGS } from './index';
import { ACT2_SONG_BPM, beatSeconds } from './bpm';
import { estimateLoudness } from './loudness';
import { PULSAR_SONG_PERIOD } from './pulsar';

const ACT2_SONGS = [
  'corona',
  'warrens',
  'junction',
  'rift',
  'foundry',
  'boss2',
  'foundry_boss',
  'escape',
] as const;
const SECTOR_SONGS = ['ion', 'horizon', 'pulsar', 'armada', 'armada_boss', ...ACT2_SONGS] as const;
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
    // Peak envelope level: a sustain above 1 (rift's swelling arps) rises past `vol`.
    const peakOf = (ch: (typeof CHANNELS)[number]) => def[ch].vol * Math.max(1, def[ch].sustain);
    for (const ch of CHANNELS) expect(peakOf(ch)).toBeLessThanOrEqual(level1[ch].vol);
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

describe('Act II songs', () => {
  it('have the design tempos, noted in bpm.ts', () => {
    for (const id of ACT2_SONGS) expect(SONGS[id]!.bpm).toBe(ACT2_SONG_BPM[id]);
    expect(ACT2_SONG_BPM).toMatchObject({
      corona: 140,
      warrens: 110,
      junction: 126,
      rift: 96,
      foundry: 136,
      escape: 160,
    });
    expect(SONGS.boss2!.bpm).toBeGreaterThan(SONGS.boss!.bpm);
    expect(SONGS.foundry_boss!.bpm).toBeGreaterThan(SONGS.armada_boss!.bpm);
    expect(beatSeconds('escape')).toBeCloseTo(0.375, 9);
  });

  it.each(ACT2_SONGS)('%s has whole-bar patterns, so beats stay on the bar grid', (id) => {
    const s = compileSong(SONGS[id]!);
    for (const e of s.entries) expect(e.pattern.steps % 16).toBe(0);
  });

  it('foundry_boss quotes armada_boss note for note', () => {
    const quote = SONGS.foundry_boss!.patterns.Q!.p1;
    expect(quote).toBe(SONGS.armada_boss!.patterns.A!.p1);
    expect(SONGS.foundry_boss!.patterns.Q2!.p1).toBe(SONGS.armada_boss!.patterns.B!.p1);
  });

  it('the escape loop outlasts the 40 s countdown', () => {
    expect(compileSong(SONGS.escape!).loopSeconds).toBeGreaterThan(40);
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
