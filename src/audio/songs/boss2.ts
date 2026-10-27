import { rep } from '../notes';
import type { SongDef } from '../song';
import { ACT2_SONG_BPM } from './bpm';

// The shared Act II boss theme: A minor at 172 bpm, faster than `boss` (168).
// A pounding octave bass, thin 12.5 % arps, and a lead that keeps landing on
// the leading tone G♯ over the dominant. One loop is 32 bars ≈ 45 s.
const heavy = (lo: string, hi: string) =>
  `${lo} . ${lo} ${hi} ${lo} . ${lo} ${hi} ${lo} . ${lo} ${hi} ${lo} ${hi} ${lo} ${hi}`;
const ARP = {
  Am: rep('A4 C5 E5 C5', 4),
  F: rep('A4 C5 F5 C5', 4),
  G: rep('B4 D5 G5 D5', 4),
  E: rep('G#4 B4 E5 B4', 4),
  Dm: rep('A4 D5 F5 D5', 4),
};
const BASS = {
  Am: heavy('A1', 'A2'),
  F: heavy('F1', 'F2'),
  G: heavy('G1', 'G2'),
  E: heavy('E1', 'E2'),
  Dm: heavy('D2', 'D3'),
};
const BEAT = 'k . h k s . h k k . h k s . s s';
const CRASH = 'c . h k s . h k k . h k s . s s';
const ROLL = 's s s s s s s s t t t t s s s s';
const DOUBLE = 'k h s h k h s h k h s h k k s s';

export const boss2: SongDef = {
  id: 'boss2',
  bpm: ACT2_SONG_BPM.boss2,
  stepsPerBeat: 4,
  p1: {
    vol: 0.14,
    duty: 0.25,
    attack: 0.003,
    decay: 0.06,
    sustain: 0.7,
    release: 0.03,
    vibrato: 25,
    vibratoDelay: 0.15,
  },
  p2: { vol: 0.08, duty: 0.125, attack: 0.002, decay: 0.04, sustain: 0.3, release: 0.01 },
  tri: { vol: 0.42, attack: 0.002, decay: 0.03, sustain: 0.85, release: 0.01 },
  drums: 0.5,
  patterns: {
    I: {
      p2: `A4 ${rep('-', 15)} G#4 ${rep('-', 15)}`,
      tri: `${BASS.Am} ${BASS.E}`,
      noise: `k . . . k . . . k . . . k . k . ${ROLL}`,
    },
    A: {
      p1: 'A5 - - - E5 - A5 - B5 - C6 - B5 - A5 - | G#5 - - - - - - - E5 - - - - - - -',
      p2: `${ARP.Am} ${ARP.E}`,
      tri: `${BASS.Am} ${BASS.E}`,
      noise: `${CRASH} ${BEAT}`,
    },
    B: {
      p1: 'F5 - - - A5 - C6 - B5 - - - G5 - D5 - | E5 - - - - - G#5 - B5 - - - E6 - - -',
      p2: `${ARP.F} ${ARP.E}`,
      tri: `${BASS.F} ${BASS.E}`,
      noise: `${BEAT} ${ROLL}`,
    },
    C: {
      p1: 'D6 - - - C6 - B5 - A5 - - - F5 - A5 - | G5 - - - F5 - E5 - D5 - - - E5 - - -',
      p2: `${ARP.Dm} ${ARP.G}`,
      tri: `${BASS.Dm} ${BASS.G}`,
      noise: `${CRASH} ${BEAT}`,
    },
    D: {
      p1: 'C6 - - - B5 - A5 - G#5 - - - B5 - D6 - | E6 - - - - - - - - - - - - - - -',
      p2: `${ARP.F} ${ARP.E}`,
      tri: `${BASS.F} ${BASS.E}`,
      noise: `${BEAT} ${ROLL}`,
    },
    // Bass break: the lead drops out and the drums double up.
    E: {
      p2: `${ARP.Am} ${ARP.Am}`,
      tri: `${BASS.Am} ${BASS.Am}`,
      noise: `${DOUBLE} ${DOUBLE}`,
    },
  },
  order: ['I', 'A', 'B', 'A', 'B', 'C', 'D', 'C', 'D', 'E', 'E', 'A+2', 'B+2', 'C', 'D', 'C', 'D'],
  loop: 1,
};
