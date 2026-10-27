import { rep } from '../notes';
import type { SongDef } from '../song';
import { ACT2_SONG_BPM } from './bpm';

// Sector 7, the Warrens: E Phrygian at 110 bpm. A low, clipped square-wave
// ostinato on pulse 1 over a triangle drone, busy noise percussion like
// machinery in the rock, and a sparse lead on pulse 2 with high "lamp" pings.
// One loop is 32 bars ≈ 70 s.
const OST = 'E3 . E3 G3 . E3 A3 . E3 . E3 Bb3 . A3 G3 .';
const OST2 = 'E3 . E3 . F3 . E3 . E3 . G3 . F3 . E3 D3';
const DRONE = `E2 ${rep('-', 15)}`;
const PERC = 'k . h s h k h . k h s h h k t t';
const PERC2 = 'k h h s k h h s k h k s h h t s';
const DRILL = 's s h s s h s h s s h s t t t t';
const INTRO = 'k . . . h . . . k . . . h . h h';

export const warrens: SongDef = {
  id: 'warrens',
  bpm: ACT2_SONG_BPM.warrens,
  stepsPerBeat: 4,
  p1: { vol: 0.12, duty: 0.5, attack: 0.002, decay: 0.07, sustain: 0.4, release: 0.02 },
  p2: {
    vol: 0.07,
    duty: 0.125,
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.05,
    vibrato: 20,
    vibratoDelay: 0.25,
  },
  tri: { vol: 0.45, attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.05 },
  drums: 0.55,
  patterns: {
    I: {
      p1: `${OST} ${OST}`,
      tri: `${DRONE} ${DRONE}`,
      noise: `${INTRO} ${INTRO}`,
    },
    A: {
      p1: `${OST} ${OST}`,
      tri: `${DRONE} ${DRONE}`,
      noise: `${PERC} ${PERC2}`,
    },
    B: {
      p1: `${OST} ${OST2}`,
      p2: 'B4 - - - - - - - . . . . . . . . | C5 - - - B4 - - - G4 - - - - - - -',
      tri: `${DRONE} ${DRONE}`,
      noise: `${PERC} ${PERC2}`,
    },
    C: {
      p1: `${OST} ${OST2}`,
      p2: 'E5 - - - - - - - D5 - - - C5 - - - | B4 - - - - - - - - - - - . . . .',
      tri: `${DRONE} ${DRONE}`,
      noise: `${PERC} ${PERC2}`,
    },
    // Lamp pings: two high blips over the ostinato and a drill roll.
    D: {
      p1: `${OST} ${OST}`,
      p2: 'E6 . . . . . . . . . . . B5 . . . | . . . . E6 . . . . . . . . . . .',
      tri: `${DRONE} ${DRONE}`,
      noise: `${DRILL} ${PERC}`,
    },
    // Percussion break: the ostinato drops out under the drone.
    E: {
      tri: `${DRONE} ${DRONE}`,
      noise: `${DRILL} ${DRILL}`,
    },
  },
  order: [
    'I',
    'A',
    'B',
    'C',
    'A+1',
    'B+1',
    'C+1',
    'D',
    'D',
    'E',
    'A',
    'B',
    'C',
    'A-2',
    'C-2',
    'D',
    'E',
  ],
  loop: 1,
};
