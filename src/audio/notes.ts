/** Step value meaning "silence on this step". */
export const REST = -1;
/** Step value meaning "keep holding the previous note". */
export const TIE = -2;

const NOTE_BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOTE_RE = /^([A-Ga-g])([#b]?)(-?\d)$/;

/** `'A4'` → 69, `'C#5'` → 73, `'Bb3'` → 58. Returns NaN for anything else. */
export function noteToMidi(name: string): number {
  const m = NOTE_RE.exec(name);
  if (!m) return NaN;
  const base = NOTE_BASE[m[1]!.toUpperCase()]!;
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + acc;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function tokens(src: string): string[] {
  // `|` is a visual bar line only.
  return src.split(/[\s|]+/).filter((t) => t.length > 0);
}

/**
 * Parses a melodic step string, one token per step: a note (`C4`, `F#5`,
 * `Bb3`), `.` for a rest, or `-` to hold the previous note.
 */
export function parseNotes(src: string): number[] {
  return tokens(src).map((t) => {
    if (t === '.') return REST;
    if (t === '-') return TIE;
    const midi = noteToMidi(t);
    if (Number.isNaN(midi)) throw new Error(`bad note token "${t}"`);
    return midi;
  });
}

export const DRUMS = { k: 0, s: 1, h: 2, o: 3, c: 4, t: 5 } as const;
export type DrumKey = keyof typeof DRUMS;
export type DrumCode = (typeof DRUMS)[DrumKey];

/**
 * Parses a drum step string: `k` kick, `s` snare, `h` closed hat, `o` open
 * hat, `c` crash, `t` tom, `.` rest.
 */
export function parseDrums(src: string): number[] {
  return tokens(src).map((t) => {
    if (t === '.') return REST;
    if (!(t in DRUMS)) throw new Error(`bad drum token "${t}"`);
    return DRUMS[t as DrumKey];
  });
}

/**
 * Length in steps of the note starting at each step (1 + following ties), or
 * 0 where no note starts. Ties after a rest are treated as rests.
 */
export function noteLengths(steps: readonly number[]): number[] {
  const out = new Array<number>(steps.length).fill(0);
  for (let i = 0; i < steps.length; i++) {
    if (steps[i]! < 0) continue;
    let n = 1;
    while (i + n < steps.length && steps[i + n] === TIE) n++;
    out[i] = n;
  }
  return out;
}

/** `'A'` → {A, 0}; `'A+5'` → {A, +5}; `'B-12'` → {B, −12}. */
export function parseOrderEntry(entry: string): { pattern: string; transpose: number } {
  const m = /^(.*?)([+-]\d+)?$/.exec(entry)!;
  return { pattern: m[1]!, transpose: m[2] ? Number(m[2]) : 0 };
}

/** Song-authoring helper: repeats a step string `n` times. */
export function rep(src: string, n: number): string {
  return new Array<string>(n).fill(src).join(' ');
}
