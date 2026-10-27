import { rep } from '../notes';
import type { SongDef } from '../song';
import { ACT2_SONG_BPM } from './bpm';

// Sector 6, Corona Drift: bright D Lydian at 140 bpm. The lead leans on the
// raised fourth (G♯) over a D–E shuttle, the Lydian I–II. One loop is 32 bars ≈ 55 s.
const ARP = {
  D: rep('D4 F#4 A4 F#4', 4),
  E: rep('E4 G#4 B4 G#4', 4),
  Fsm: rep('C#4 F#4 A4 F#4', 4),
  Bm: rep('D4 F#4 B4 F#4', 4),
  A: rep('C#4 E4 A4 E4', 4),
};
const bass = (lo: string, hi: string) => rep(`${lo} . ${hi} .`, 4);
const BASS = {
  D: bass('D2', 'D3'),
  E: bass('E2', 'E3'),
  Fsm: bass('F#1', 'F#2'),
  Bm: bass('B1', 'B2'),
  A: bass('A1', 'A2'),
};
const BEAT = 'k . h . s . h k k . h . s . h h';
const CRASH = 'c . h . s . h k k . h . s . h h';
const FILL = 'k . h . s . h k k . s s t t s s';
const HALF = 'k . . . h . . . s . . . h . . .';
const REST = rep('.', 16);

export const corona: SongDef = {
  id: 'corona',
  bpm: ACT2_SONG_BPM.corona,
  stepsPerBeat: 4,
  p1: {
    vol: 0.14,
    duty: 0.25,
    attack: 0.003,
    decay: 0.08,
    sustain: 0.65,
    release: 0.03,
    vibrato: 18,
    vibratoDelay: 0.18,
  },
  p2: { vol: 0.08, duty: 0.125, attack: 0.002, decay: 0.05, sustain: 0.35, release: 0.015 },
  tri: { vol: 0.48, attack: 0.002, decay: 0.04, sustain: 0.85, release: 0.015 },
  drums: 0.5,
  patterns: {
    I: {
      p2: `${ARP.D} ${ARP.E}`,
      tri: `${BASS.D} ${BASS.E}`,
      noise: `k . h . k . h . k . h . k . h . ${FILL}`,
    },
    A: {
      p1: 'A5 - - - G#5 - A5 - B5 - - - A5 - F#5 - | E5 - - - - - D5 - E5 - G#5 - B5 - - -',
      p2: `${ARP.D} ${ARP.E}`,
      tri: `${BASS.D} ${BASS.E}`,
      noise: `${CRASH} ${BEAT}`,
    },
    B: {
      p1: 'C#6 - - - B5 - A5 - G#5 - - - E5 - F#5 - | D5 - - - - - - - . . A4 - D5 - E5 -',
      p2: `${ARP.Fsm} ${ARP.D}`,
      tri: `${BASS.Fsm} ${BASS.D}`,
      noise: `${BEAT} ${FILL}`,
    },
    C: {
      p1: 'F#5 - - - D5 - F#5 - B5 - - - A5 - G#5 - | G#5 - - - - - - - E5 - - - B4 - - -',
      p2: `${ARP.Bm} ${ARP.E}`,
      tri: `${BASS.Bm} ${BASS.E}`,
      noise: `${CRASH} ${BEAT}`,
    },
    D: {
      p1: 'A5 - B5 - C#6 - D6 - E6 - - - D6 - C#6 - | B5 - - - G#5 - - - E5 - - - - - - -',
      p2: `${ARP.A} ${ARP.E}`,
      tri: `${BASS.A} ${BASS.E}`,
      noise: `${BEAT} ${FILL}`,
    },
    // Breakdown: arps and bass over half-time drums, then a pickup back in.
    E: {
      p2: `${ARP.D} ${ARP.E}`,
      tri: `${BASS.D} ${BASS.E}`,
      noise: `${HALF} ${HALF}`,
    },
    E2: {
      p1: `${REST} A4 - - - C#5 - - - E5 - - - G#5 - A5 -`,
      p2: `${ARP.A} ${ARP.E}`,
      tri: `${BASS.A} ${BASS.E}`,
      noise: `${HALF} ${FILL}`,
    },
  },
  order: ['I', 'A', 'B', 'A', 'B', 'C', 'D', 'C', 'D', 'E', 'E2', 'A+2', 'B+2', 'C', 'D', 'A', 'D'],
  loop: 1,
};
