import { describe, expect, it } from 'vitest';
import { REST } from './notes';
import {
  advanceCursor,
  compileSong,
  scheduleWindow,
  stepDuration,
  type SongCursor,
  type SongDef,
} from './song';
import { SONG_IDS, SONGS } from './songs';
import { pulseCoefficients } from './waves';

const inst = { vol: 1, attack: 0, decay: 0, sustain: 1, release: 0 };
function def(over: Partial<SongDef>): SongDef {
  return {
    id: 't',
    bpm: 120,
    stepsPerBeat: 4,
    patterns: { A: { p1: 'C4 - E4 .', noise: 'k . s .' }, B: { tri: 'C2 . . .' } },
    order: ['A', 'B'],
    loop: 0,
    p1: inst,
    p2: inst,
    tri: inst,
    drums: 1,
    ...over,
  };
}

describe('stepDuration', () => {
  it('is a sixteenth note at 4 steps per beat', () => {
    expect(stepDuration(120, 4)).toBeCloseTo(0.125);
    expect(stepDuration(150, 4)).toBeCloseTo(0.1);
  });
});

describe('compileSong', () => {
  it('folds ties into note lengths', () => {
    const s = compileSong(def({}));
    const p1 = s.entries[0]!.pattern.p1!;
    expect(Array.from(p1.notes)).toEqual([60, REST, 64, REST]);
    expect(Array.from(p1.lengths)).toEqual([2, 0, 1, 0]);
    expect(s.entries[0]!.pattern.p2).toBeNull();
  });

  it('rejects patterns whose channels differ in length', () => {
    expect(() => compileSong(def({ patterns: { A: { p1: 'C4 .', tri: 'C2' } } }))).toThrow(
      /lengths/,
    );
  });

  it('rejects unknown patterns in the order', () => {
    expect(() => compileSong(def({ order: ['A', 'Z'] }))).toThrow(/Z/);
  });

  it('applies order transposition', () => {
    const s = compileSong(def({ order: ['A', 'A+5'] }));
    expect(s.entries[1]!.transpose).toBe(5);
    expect(s.entries[1]!.pattern).toBe(s.entries[0]!.pattern);
  });
});

describe('advanceCursor', () => {
  it('walks patterns and jumps back to the loop point', () => {
    const s = compileSong(def({ order: ['A', 'B', 'A'], loop: 1 }));
    const c: SongCursor = { entry: 0, step: 0, done: false };
    const seen: string[] = [];
    for (let i = 0; i < 16; i++) {
      seen.push(`${c.entry}:${c.step}`);
      advanceCursor(s, c);
    }
    expect(seen.slice(0, 13)).toEqual([
      '0:0',
      '0:1',
      '0:2',
      '0:3',
      '1:0',
      '1:1',
      '1:2',
      '1:3',
      '2:0',
      '2:1',
      '2:2',
      '2:3',
      '1:0',
    ]);
    expect(c.done).toBe(false);
  });

  it('finishes a non-looping song', () => {
    const s = compileSong(def({ order: ['A'], loop: -1 }));
    const c: SongCursor = { entry: 0, step: 0, done: false };
    for (let i = 0; i < 4; i++) advanceCursor(s, c);
    expect(c.done).toBe(true);
  });
});

describe('scheduleWindow', () => {
  it('schedules every step inside the horizon on an exact grid', () => {
    const times: number[] = [];
    const next = scheduleWindow(1, 0.1, 1.35, (t) => times.push(t) > 0);
    expect(times.map((t) => +t.toFixed(6))).toEqual([1, 1.1, 1.2, 1.3]);
    expect(next).toBeCloseTo(1.4);
  });

  it('catches up after a late timer without drifting the tempo', () => {
    // A timer that fires late just schedules more steps; the next step stays on the grid.
    const next = scheduleWindow(0, 0.1, 0.95, () => true);
    expect(next).toBeCloseTo(1.0);
  });
});

describe('songs', () => {
  it('ships title, level1, boss and clear', () => {
    expect(SONG_IDS.sort()).toEqual(['boss', 'clear', 'level1', 'title']);
  });

  it.each(SONG_IDS)('%s compiles with consistent pattern lengths', (id) => {
    const s = compileSong(SONGS[id]!);
    for (const e of s.entries) expect(e.pattern.steps % 16).toBe(0);
  });

  it('level1 loops in about 45 s', () => {
    const s = compileSong(SONGS.level1!);
    expect(s.loopSeconds).toBeGreaterThan(40);
    expect(s.loopSeconds).toBeLessThan(50);
  });

  it('boss is faster than level1, and clear does not loop', () => {
    expect(SONGS.boss!.bpm).toBeGreaterThan(SONGS.level1!.bpm);
    expect(SONGS.clear!.loop).toBe(-1);
  });

  it('keeps every note in a sane register', () => {
    for (const id of SONG_IDS) {
      const s = compileSong(SONGS[id]!);
      for (const e of s.entries) {
        for (const ch of ['p1', 'p2', 'tri'] as const) {
          const track = e.pattern[ch];
          if (!track) continue;
          for (const n of track.notes) {
            if (n === REST) continue;
            expect(n + e.transpose).toBeGreaterThanOrEqual(28);
            expect(n + e.transpose).toBeLessThanOrEqual(96);
          }
        }
      }
    }
  });
});

describe('pulseCoefficients', () => {
  it('has no DC term and a 50 % duty with only odd harmonics', () => {
    const c = pulseCoefficients(0.5, 6);
    expect(c[0]).toBe(0);
    expect(c[2]).toBeCloseTo(0);
    expect(c[4]).toBeCloseTo(0);
    expect(c[1]).toBeGreaterThan(0);
  });
});
