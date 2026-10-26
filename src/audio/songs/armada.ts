import type { SongDef } from '../song';

// Sector 5, the Armada: a G minor military march at 132 bpm. Dotted-rhythm
// horn stabs on pulse 2, an oom-pah triangle bass, and snare-led drums. The
// C section lifts to the relative B♭ major. One loop is 32 bars ≈ 58 s.
const stab = (n: string) => `${n} - - ${n} . . . . ${n} - - ${n} . . . .`;
const march = (r: string, f: string) => `${r} . . . ${f} . . . ${r} . . . ${f} . ${r} .`;
const STAB = {
  Gm: stab('D4'),
  Eb: stab('Eb4'),
  F: stab('F4'),
  D: stab('F#4'),
  Cm: stab('Eb4'),
  Bb: stab('D4'),
};
const BASS = {
  Gm: march('G2', 'D2'),
  Eb: march('Eb2', 'Bb1'),
  F: march('F2', 'C2'),
  D: march('D2', 'A1'),
  Cm: march('C2', 'G1'),
  Bb: march('Bb1', 'F2'),
};
const MARCH = 'k . . . s . . s k . . . s . s s';
const CRASH = 'c . . . s . . s k . . . s . s s';
const ROLL = 'k . s s s . s s k . s s s s s s';
const SNARES = 's . s s s . s . s . s s s . s .';

export const armada: SongDef = {
  id: 'armada',
  bpm: 132,
  stepsPerBeat: 4,
  p1: {
    vol: 0.16,
    duty: 0.25,
    attack: 0.004,
    decay: 0.08,
    sustain: 0.7,
    release: 0.04,
    vibrato: 15,
    vibratoDelay: 0.2,
  },
  p2: { vol: 0.09, duty: 0.25, attack: 0.002, decay: 0.06, sustain: 0.5, release: 0.02 },
  tri: { vol: 0.55, attack: 0.002, decay: 0.04, sustain: 0.85, release: 0.015 },
  drums: 0.6,
  patterns: {
    I: {
      p2: `${STAB.Gm} ${STAB.Gm}`,
      tri: `${BASS.Gm} ${BASS.Gm}`,
      noise: `${SNARES} ${ROLL}`,
    },
    A: {
      p1: 'G4 - - G4 Bb4 - - G4 D5 - - - - - - - | Eb5 - - D5 C5 - - Bb4 G4 - - - - - . .',
      p2: `${STAB.Gm} ${STAB.Eb}`,
      tri: `${BASS.Gm} ${BASS.Eb}`,
      noise: `${CRASH} ${MARCH}`,
    },
    B: {
      p1: 'F4 - - F4 A4 - - C5 F5 - - - Eb5 - D5 - | D5 - - - - - - - A4 - - - F#4 - - -',
      p2: `${STAB.F} ${STAB.D}`,
      tri: `${BASS.F} ${BASS.D}`,
      noise: `${MARCH} ${ROLL}`,
    },
    C: {
      p1: 'D5 - - D5 F5 - - D5 Bb5 - - - A5 - G5 - | F5 - - - - - - - C5 - - - - - - -',
      p2: `${STAB.Bb} ${STAB.F}`,
      tri: `${BASS.Bb} ${BASS.F}`,
      noise: `${CRASH} ${MARCH}`,
    },
    D: {
      p1: 'Eb5 - - Eb5 G5 - - Eb5 C6 - - - Bb5 - A5 - | A5 - - - - - - - F#5 - - - D5 - - -',
      p2: `${STAB.Cm} ${STAB.D}`,
      tri: `${BASS.Cm} ${BASS.D}`,
      noise: `${MARCH} ${ROLL}`,
    },
    // Drum-corps break: snares, stabs and bass.
    E: {
      p2: `${STAB.Gm} ${STAB.Cm}`,
      tri: `${BASS.Gm} ${BASS.Cm}`,
      noise: `${SNARES} ${SNARES}`,
    },
  },
  order: ['I', 'A', 'B', 'A', 'B', 'C', 'D', 'C', 'D', 'E', 'A', 'B', 'A+5', 'B+5', 'E', 'C', 'D'],
  loop: 1,
};
