import type { SongDef } from '../song';
import { ACT2_SONG_BPM } from './bpm';

// Sector 10, the Foundry: an industrial march in C minor at 136 bpm. Pulse 2
// hammers a machine-press figure, toms clank on the off-beats, and the lead's
// opening motif comes back in `foundry_boss`. One loop is 32 bars ≈ 56 s.
const press = (r: string, f: string) =>
  `${r} ${r} . ${r} ${f} . ${r} . ${r} ${r} . ${r} ${f} . ${r} .`;
const PRESS = {
  Cm: press('C4', 'G4'),
  Ab: press('C4', 'Ab4'),
  Bb: press('D4', 'Bb4'),
  G: press('D4', 'B4'),
  Fm: press('C4', 'F4'),
};
const march = (r: string, f: string) => `${r} . . . ${f} . . . ${r} . . . ${f} . ${r} .`;
const BASS = {
  Cm: march('C2', 'G1'),
  Ab: march('Ab1', 'Eb2'),
  Bb: march('Bb1', 'F2'),
  G: march('G1', 'D2'),
  Fm: march('F2', 'C2'),
};
const HAMMER = 'k . t . s . t . k . t . s t s .';
const HAMMER2 = 'k . t . s . t k k . t . s . s s';
const CRASH = 'c . t . s . t . k . t . s t s .';
const ROLL = 's . s s s . s s t t t t s s s s';

export const foundry: SongDef = {
  id: 'foundry',
  bpm: ACT2_SONG_BPM.foundry,
  stepsPerBeat: 4,
  p1: {
    vol: 0.13,
    duty: 0.5,
    attack: 0.004,
    decay: 0.08,
    sustain: 0.6,
    release: 0.04,
    vibrato: 15,
    vibratoDelay: 0.2,
  },
  p2: { vol: 0.08, duty: 0.5, attack: 0.002, decay: 0.04, sustain: 0.25, release: 0.01 },
  tri: { vol: 0.48, attack: 0.002, decay: 0.04, sustain: 0.85, release: 0.015 },
  drums: 0.55,
  patterns: {
    I: {
      p2: `${PRESS.Cm} ${PRESS.Cm}`,
      tri: `${BASS.Cm} ${BASS.Cm}`,
      noise: `k . . . k . . . k . . . k . k . ${ROLL}`,
    },
    A: {
      p1: 'C5 - - - G4 - - C5 Eb5 - - - D5 - C5 - | Bb4 - - - G4 - - - - - - - . . . .',
      p2: `${PRESS.Cm} ${PRESS.Bb}`,
      tri: `${BASS.Cm} ${BASS.Bb}`,
      noise: `${CRASH} ${HAMMER2}`,
    },
    B: {
      p1: 'Ab4 - - - C5 - - Eb5 Ab5 - - - G5 - F5 - | G5 - - - - - - - D5 - - - B4 - - -',
      p2: `${PRESS.Ab} ${PRESS.G}`,
      tri: `${BASS.Ab} ${BASS.G}`,
      noise: `${HAMMER} ${HAMMER2}`,
    },
    C: {
      p1: 'Eb5 - - - F5 - G5 - Ab5 - - - G5 - F5 - | Eb5 - - - D5 - - - C5 - - - - - - -',
      p2: `${PRESS.Fm} ${PRESS.Cm}`,
      tri: `${BASS.Fm} ${BASS.Cm}`,
      noise: `${CRASH} ${HAMMER2}`,
    },
    // The line stops; only the press and the hammers.
    D: {
      p2: `${PRESS.Cm} ${PRESS.Ab}`,
      tri: `${BASS.Cm} ${BASS.Ab}`,
      noise: `${HAMMER} ${ROLL}`,
    },
  },
  order: ['I', 'A', 'B', 'A', 'B', 'C', 'D', 'C', 'D', 'A+2', 'B+2', 'C', 'D', 'A', 'B', 'C', 'D'],
  loop: 1,
};
