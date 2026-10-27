import { rep } from '../notes';
import type { SongDef } from '../song';
import { ACT2_SONG_BPM } from './bpm';

// Sector 8, Wormhole Junction: G Dorian at 126 bpm, syncopated on a 3+3+3+3+2+2
// grid. The pulse channels trade bars, call and response, like a signal going
// in one portal and out the other, then lock together in harmonized stabs.
// One loop is 32 bars ≈ 61 s.
const sync = (r: string, hi: string, b7: string) =>
  `${r} . . ${r} . . ${hi} . . ${r} . . ${b7} . ${r} .`;
const BASS = {
  Gm: sync('G2', 'G3', 'F2'),
  C: sync('C2', 'C3', 'Bb1'),
  Eb: sync('Eb2', 'Eb3', 'D2'),
  F: sync('F2', 'F3', 'Eb2'),
};
const R = rep('.', 16);
const CALL1 = 'G5 . . Bb5 . . D6 . C6 - Bb5 . G5 - . .';
const RESP1 = 'D5 . . F5 . . A5 . G5 - F5 . E5 - . .';
const CALL2 = 'Eb6 . . D6 . . C6 . Bb5 - A5 . F5 - . .';
const RESP2 = 'C5 . . D5 . . Eb5 . F5 - G5 . A5 - . .';
const SYNC = 'k . . k . . s . . k . . s . h .';
const SYNC2 = 'k . h k . h s . h k . h s h s s';
const CRASH = 'c . . k . . s . . k . . s . h .';
const BREAK = 'k . . . . . s . . k . . . . s .';

export const junction: SongDef = {
  id: 'junction',
  bpm: ACT2_SONG_BPM.junction,
  stepsPerBeat: 4,
  p1: {
    vol: 0.12,
    duty: 0.25,
    attack: 0.003,
    decay: 0.06,
    sustain: 0.5,
    release: 0.02,
    vibrato: 12,
    vibratoDelay: 0.2,
  },
  p2: { vol: 0.1, duty: 0.25, attack: 0.003, decay: 0.06, sustain: 0.5, release: 0.02 },
  tri: { vol: 0.45, attack: 0.002, decay: 0.04, sustain: 0.7, release: 0.015 },
  drums: 0.55,
  patterns: {
    I: {
      tri: `${BASS.Gm} ${BASS.Gm}`,
      noise: `${SYNC} ${SYNC2}`,
    },
    A: {
      p1: `${CALL1} ${R}`,
      p2: `${R} ${RESP1}`,
      tri: `${BASS.Gm} ${BASS.C}`,
      noise: `${CRASH} ${SYNC2}`,
    },
    B: {
      p1: `${CALL2} ${R}`,
      p2: `${R} ${RESP2}`,
      tri: `${BASS.Eb} ${BASS.F}`,
      noise: `${SYNC} ${SYNC2}`,
    },
    // Both channels together, a third apart.
    C: {
      p1: 'G5 . . G5 . . A5 . . Bb5 . . A5 . G5 . | C6 . . C6 . . Bb5 . . A5 . . G5 . F5 .',
      p2: 'D5 . . D5 . . E5 . . G5 . . F5 . D5 . | G5 . . G5 . . F5 . . E5 . . D5 . C5 .',
      tri: `${BASS.Gm} ${BASS.C}`,
      noise: `${CRASH} ${SYNC2}`,
    },
    // Breakdown: lone blips bouncing between the channels.
    D: {
      p1: rep('. . G6 . . . . . D6 . . . . . G6 .', 2),
      p2: rep('G5 . . . . . D5 . . . G5 . . . . .', 2),
      tri: `${BASS.Gm} ${BASS.Gm}`,
      noise: `${BREAK} ${BREAK}`,
    },
  },
  order: ['I', 'A', 'B', 'A', 'B', 'C', 'C', 'D', 'A+5', 'B+5', 'A', 'B', 'C', 'C', 'D', 'D', 'B'],
  loop: 1,
};
