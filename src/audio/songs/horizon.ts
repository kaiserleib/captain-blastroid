import type { SongDef } from '../song';

// Sector 3, Event Horizon: slow and heavy C phrygian at 100 bpm. Pulse 2
// doubles the triangle bass an octave up with instant vibrato, so the two beat
// against each other like a detuned synth bass. Sparse noise hits.
// One loop is 32 bars ≈ 77 s.
const bass = (r: string, x: string) => `${r} - - - - - - - - - . . ${x} - - .`;
const BASS = {
  Cm: bass('C2', 'C2'),
  Db: bass('Db2', 'Ab1'),
  Bb: bass('Bb1', 'F2'),
  Ab: bass('Ab1', 'Eb2'),
  G: bass('G1', 'D2'),
};
const DOUBLE = {
  Cm: bass('C3', 'C3'),
  Db: bass('Db3', 'Ab2'),
  Bb: bass('Bb2', 'F3'),
  Ab: bass('Ab2', 'Eb3'),
  G: bass('G2', 'D3'),
};
const HIT = 'k . . . . . . . s . . . . . . .';
const HIT2 = 'k . . . . . k . s . . . . . t t';
const BOOM = 'c . . . . . . . s . . . . . . .';
const DRIP = 'k . . . . . . . . . . . h . . .';

export const horizon: SongDef = {
  id: 'horizon',
  bpm: 100,
  stepsPerBeat: 4,
  p1: {
    vol: 0.16,
    duty: 0.25,
    attack: 0.02,
    decay: 0.2,
    sustain: 0.6,
    release: 0.12,
    vibrato: 22,
    vibratoDelay: 0.3,
  },
  p2: {
    vol: 0.08,
    duty: 0.5,
    attack: 0.01,
    decay: 0.15,
    sustain: 0.6,
    release: 0.05,
    vibrato: 14,
    vibratoDelay: 0.02,
  },
  tri: { vol: 0.5, attack: 0.004, decay: 0.08, sustain: 0.85, release: 0.03 },
  drums: 0.6,
  patterns: {
    I: {
      p2: `${DOUBLE.Cm} ${DOUBLE.Cm}`,
      tri: `${BASS.Cm} ${BASS.Cm}`,
      noise: `${DRIP} ${HIT}`,
    },
    A: {
      p1: 'G4 - - - - - - - - - - - Ab4 - - - | G4 - - - - - - - F4 - - - Eb4 - - -',
      p2: `${DOUBLE.Cm} ${DOUBLE.Db}`,
      tri: `${BASS.Cm} ${BASS.Db}`,
      noise: `${BOOM} ${HIT}`,
    },
    B: {
      p1: 'C5 - - - - - - - Bb4 - - - G4 - - - | F4 - - - - - - - - - - - . . . .',
      p2: `${DOUBLE.Cm} ${DOUBLE.Bb}`,
      tri: `${BASS.Cm} ${BASS.Bb}`,
      noise: `${HIT} ${HIT2}`,
    },
    C: {
      p1: 'Eb5 - - - - - - - D5 - - - C5 - - - | B4 - - - - - - - - - - - - - - -',
      p2: `${DOUBLE.Ab} ${DOUBLE.G}`,
      tri: `${BASS.Ab} ${BASS.G}`,
      noise: `${BOOM} ${HIT2}`,
    },
    D: {
      p1: 'Ab4 - - - - - - - - - - - F4 - - - | D5 - - - - - - - B4 - - - G4 - - -',
      p2: `${DOUBLE.Db} ${DOUBLE.G}`,
      tri: `${BASS.Db} ${BASS.G}`,
      noise: `${HIT} ${HIT2}`,
    },
    // The lead and the doubled bass drop out: just the triangle and the void.
    E: {
      tri: `${BASS.Cm} ${BASS.Db}`,
      noise: `${DRIP} ${DRIP}`,
    },
  },
  order: [
    'I',
    'A',
    'B',
    'A',
    'C',
    'E',
    'A',
    'B',
    'D',
    'C',
    'A+5',
    'B+5',
    'A+5',
    'C+5',
    'E',
    'D',
    'C',
  ],
  loop: 1,
};
