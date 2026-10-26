import { rep } from '../notes';
import type { SongDef } from '../song';

// Sector 4, Pulsar Nursery: a driving A major arpeggio at exactly 120 bpm.
//
// Phase lock for T29: one step is 0.125 s, and every pattern is a multiple of
// 24 steps (6 beats = 3.0 s), the intro before the loop point included. The
// kick lands on step 0 of every 24-step group and nowhere else, so a kick
// sounds at song time t = 3.0·k s from the moment the song starts, across
// loops too. Patterns are 48 steps (two pulses), and the melody phrases in
// 6-beat halves to match. One loop is 14 × 6 s = 84 s (42 bars of 4/4).
const arp6 = (a: string, b: string, c: string, d: string) =>
  rep(`${a} ${b} ${c} ${d} ${c} ${b}`, 4);
const ARP = {
  A: arp6('A3', 'C#4', 'E4', 'A4'),
  Fsm: arp6('F#3', 'A3', 'C#4', 'F#4'),
  D: arp6('D4', 'F#4', 'A4', 'D5'),
  E: arp6('E4', 'G#4', 'B4', 'E5'),
  Bm: arp6('B3', 'D4', 'F#4', 'B4'),
  Csm: arp6('C#4', 'E4', 'G#4', 'C#5'),
};
const bass = (r: string, o: string) => rep(`${r} . ${o} .`, 6);
const BASS = {
  A: bass('A1', 'A2'),
  Fsm: bass('F#1', 'F#2'),
  D: bass('D2', 'D3'),
  E: bass('E2', 'E3'),
  Bm: bass('B1', 'B2'),
  Csm: bass('C#2', 'C#3'),
};
// 24 steps each; `k` only on step 0, the pulse.
const PULSE = 'k . h . s . h . h . s . h . o . s . h . s . h h';
const FILL = 'k . h . s . h . h . s . s . t . t . s s s s s s';
const LIGHT = 'k . . . h . . . h . . . h . . . h . . . h . h .';

/** Seconds between pulsar kicks; T29 phase-locks the sector's pulsars to this. */
export const PULSAR_SONG_PERIOD = 3;

export const pulsar: SongDef = {
  id: 'pulsar',
  bpm: 120,
  stepsPerBeat: 4,
  p1: {
    vol: 0.16,
    duty: 0.25,
    attack: 0.004,
    decay: 0.1,
    sustain: 0.65,
    release: 0.05,
    vibrato: 18,
    vibratoDelay: 0.2,
  },
  p2: { vol: 0.09, duty: 0.25, attack: 0.002, decay: 0.05, sustain: 0.35, release: 0.015 },
  tri: { vol: 0.55, attack: 0.002, decay: 0.04, sustain: 0.85, release: 0.015 },
  drums: 0.6,
  patterns: {
    I: {
      p2: `${ARP.A} ${ARP.A}`,
      tri: `${BASS.A} ${BASS.A}`,
      noise: `${LIGHT} ${LIGHT}`,
    },
    A: {
      p1:
        'E5 - - - - - - - - - - - C#5 - - - - - E5 - - - F#5 - | ' +
        'A5 - - - - - - - - - - - G#5 - - - - - E5 - - - C#5 -',
      p2: `${ARP.A} ${ARP.Fsm}`,
      tri: `${BASS.A} ${BASS.Fsm}`,
      noise: `${PULSE} ${PULSE}`,
    },
    B: {
      p1:
        'F#5 - - - - - - - - - - - A5 - - - - - F#5 - - - D5 - | ' +
        'E5 - - - - - - - - - - - - - - - - - B4 - - - - -',
      p2: `${ARP.D} ${ARP.E}`,
      tri: `${BASS.D} ${BASS.E}`,
      noise: `${PULSE} ${FILL}`,
    },
    C: {
      p1:
        'D5 - - - - - F#5 - - - - - B5 - - - - - A5 - - - F#5 - | ' +
        'G#5 - - - - - - - - - - - E5 - - - - - G#5 - - - C#6 -',
      p2: `${ARP.Bm} ${ARP.Csm}`,
      tri: `${BASS.Bm} ${BASS.Csm}`,
      noise: `${PULSE} ${PULSE}`,
    },
    D: {
      p1:
        'A5 - - - - - F#5 - - - - - D5 - - - - - F#5 - - - A5 - | ' +
        'B5 - - - - - - - - - - - G#5 - - - - - E5 - - - B5 -',
      p2: `${ARP.D} ${ARP.E}`,
      tri: `${BASS.D} ${BASS.E}`,
      noise: `${PULSE} ${FILL}`,
    },
    // Breakdown: arps and pulses only.
    E: {
      p2: `${ARP.Fsm} ${ARP.D}`,
      tri: `${BASS.Fsm} ${BASS.D}`,
      noise: `${LIGHT} ${LIGHT}`,
    },
  },
  order: ['I', 'A', 'B', 'A', 'D', 'C', 'D', 'E', 'E', 'C', 'B', 'A+3', 'B+3', 'C', 'D'],
  loop: 1,
};
