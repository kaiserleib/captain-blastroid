import { noteLengths, parseDrums, parseNotes, parseOrderEntry, REST } from './notes';

export type PulseDuty = 0.125 | 0.25 | 0.5;

export interface Instrument {
  /** Peak gain, 0..1. */
  vol: number;
  attack: number;
  decay: number;
  /** Fraction of `vol` held after the decay. */
  sustain: number;
  release: number;
  /** Pulse channels only. */
  duty?: PulseDuty;
  /** Vibrato depth in cents, faded in after `vibratoDelay` seconds on long notes. */
  vibrato?: number;
  vibratoRate?: number;
  vibratoDelay?: number;
}

/** One pattern: a step string per channel. Missing channels are silent. */
export interface PatternDef {
  p1?: string;
  p2?: string;
  tri?: string;
  noise?: string;
}

export interface SongDef {
  id: string;
  bpm: number;
  /** Steps per beat; 4 = sixteenth-note grid. */
  stepsPerBeat: number;
  patterns: Record<string, PatternDef>;
  /** Pattern names, optionally transposed in semitones: `'A'`, `'A+5'`. */
  order: string[];
  /** Index in `order` to jump back to after the last entry, or −1 to stop. */
  loop: number;
  p1: Instrument;
  p2: Instrument;
  tri: Instrument;
  /** Drum mix level. */
  drums: number;
}

export const CHANNELS = ['p1', 'p2', 'tri'] as const;
export type MelodicChannel = (typeof CHANNELS)[number];

export interface CompiledTrack {
  /** MIDI note starting on each step, or REST. */
  notes: Int16Array;
  /** Length in steps of the note starting there (0 where none starts). */
  lengths: Uint16Array;
}

export interface CompiledPattern {
  steps: number;
  p1: CompiledTrack | null;
  p2: CompiledTrack | null;
  tri: CompiledTrack | null;
  noise: Int8Array | null;
}

export interface CompiledEntry {
  pattern: CompiledPattern;
  transpose: number;
}

export interface CompiledSong {
  def: SongDef;
  stepDur: number;
  entries: CompiledEntry[];
  loop: number;
  /** Seconds from the loop point to the end, i.e. one loop's length. */
  loopSeconds: number;
  totalSteps: number;
}

export function stepDuration(bpm: number, stepsPerBeat: number): number {
  return 60 / bpm / stepsPerBeat;
}

function compileTrack(src: string): CompiledTrack {
  const steps = parseNotes(src);
  const lens = noteLengths(steps);
  const notes = new Int16Array(steps.length);
  for (let i = 0; i < steps.length; i++) notes[i] = lens[i]! > 0 ? steps[i]! : REST;
  return { notes, lengths: Uint16Array.from(lens) };
}

/** Parses all step strings up front and checks every channel of a pattern has the same length. */
export function compileSong(def: SongDef): CompiledSong {
  const patterns = new Map<string, CompiledPattern>();
  for (const [name, p] of Object.entries(def.patterns)) {
    const c: CompiledPattern = {
      steps: 0,
      p1: p.p1 ? compileTrack(p.p1) : null,
      p2: p.p2 ? compileTrack(p.p2) : null,
      tri: p.tri ? compileTrack(p.tri) : null,
      noise: p.noise ? Int8Array.from(parseDrums(p.noise)) : null,
    };
    const lens = [c.p1?.notes.length, c.p2?.notes.length, c.tri?.notes.length, c.noise?.length];
    const defined = lens.filter((n): n is number => n !== undefined);
    if (defined.length === 0) throw new Error(`${def.id}/${name}: empty pattern`);
    if (defined.some((n) => n !== defined[0])) {
      throw new Error(`${def.id}/${name}: channel lengths differ (${lens.join(', ')})`);
    }
    c.steps = defined[0]!;
    patterns.set(name, c);
  }
  const entries = def.order.map((e) => {
    const { pattern, transpose } = parseOrderEntry(e);
    const p = patterns.get(pattern);
    if (!p) throw new Error(`${def.id}: unknown pattern "${pattern}" in order`);
    return { pattern: p, transpose };
  });
  if (def.loop >= entries.length) throw new Error(`${def.id}: loop index out of range`);
  const stepDur = stepDuration(def.bpm, def.stepsPerBeat);
  let totalSteps = 0;
  let loopSteps = 0;
  entries.forEach((e, i) => {
    totalSteps += e.pattern.steps;
    if (def.loop >= 0 && i >= def.loop) loopSteps += e.pattern.steps;
  });
  return { def, stepDur, entries, loop: def.loop, loopSeconds: loopSteps * stepDur, totalSteps };
}

/** Position in a song. `done` once a non-looping song runs off its end. */
export interface SongCursor {
  entry: number;
  step: number;
  done: boolean;
}

/** Moves the cursor one step forward in place, following the loop point. */
export function advanceCursor(song: CompiledSong, c: SongCursor): void {
  if (c.done) return;
  c.step++;
  if (c.step < song.entries[c.entry]!.pattern.steps) return;
  c.step = 0;
  c.entry++;
  if (c.entry < song.entries.length) return;
  if (song.loop < 0) {
    c.done = true;
    c.entry = song.entries.length - 1;
  } else {
    c.entry = song.loop;
  }
}

/**
 * Lookahead scheduling: calls `schedule(time)` for every step whose start
 * falls before `horizon`, and returns the next unscheduled step's time. Step
 * times come from the audio clock, so a late timer never drifts the tempo.
 */
export function scheduleWindow(
  nextTime: number,
  stepDur: number,
  horizon: number,
  schedule: (time: number) => boolean,
): number {
  let t = nextTime;
  while (t < horizon) {
    if (!schedule(t)) break;
    t += stepDur;
  }
  return t;
}
