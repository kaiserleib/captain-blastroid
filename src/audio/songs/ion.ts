import { rep } from '../notes';
import type { SongDef } from '../song';

// Sector 2, Ion Shoals: mysterious A minor at 128 bpm. A thin 12.5 % lead over
// add9/maj7 square arps and a lilting triangle bass; the back half lifts to
// D minor. One loop is 32 bars = 60 s.
const ARP = {
  Am9: rep('A3 E4 B4 C5', 4),
  Fmaj7: rep('F3 C4 E4 A4', 4),
  G6: rep('G3 D4 E4 B4', 4),
  Em: rep('E3 B3 E4 G4', 4),
  Dm: rep('D4 F4 A4 E5', 4),
  E7: rep('E3 G#3 B3 D4', 4),
};
const bass = (r: string, f: string) => `${r} - - . ${r} . ${f} . ${r} - - . ${r} . ${f} .`;
const BASS = {
  Am: bass('A1', 'E2'),
  F: bass('F1', 'C2'),
  G: bass('G1', 'D2'),
  Em: bass('E2', 'B1'),
  Dm: bass('D2', 'A1'),
  E: bass('E2', 'B1'),
};
const BEAT = 'k . . h . . s . . h k . s . h .';
const CRASH = 'c . . h . . s . . h k . s . h .';
const FILL = 'k . . h . . s . . h s . t t s s';
const HATS = 'h . . h . . h . . h . . h . h .';
const HALF = 'k . . . . . h . s . . . . . h .';
const REST = rep('.', 16);

export const ion: SongDef = {
  id: 'ion',
  bpm: 128,
  stepsPerBeat: 4,
  p1: {
    vol: 0.16,
    duty: 0.125,
    attack: 0.006,
    decay: 0.1,
    sustain: 0.6,
    release: 0.06,
    vibrato: 20,
    vibratoDelay: 0.22,
  },
  p2: { vol: 0.09, duty: 0.25, attack: 0.002, decay: 0.05, sustain: 0.35, release: 0.015 },
  tri: { vol: 0.55, attack: 0.002, decay: 0.04, sustain: 0.85, release: 0.015 },
  drums: 0.55,
  patterns: {
    I: {
      p2: `${ARP.Am9} ${ARP.Fmaj7}`,
      tri: `${BASS.Am} ${BASS.F}`,
      noise: `${HATS} ${HATS}`,
    },
    A: {
      p1: 'E5 - - - - - B4 - C5 - - - D5 - E5 - | F5 - - - E5 - - - C5 - - - A4 - - -',
      p2: `${ARP.Am9} ${ARP.Fmaj7}`,
      tri: `${BASS.Am} ${BASS.F}`,
      noise: `${CRASH} ${BEAT}`,
    },
    B: {
      p1: 'D5 - - - - - B4 - G4 - - - A4 - B4 - | G4 - - - - - - - E4 - - - - - . .',
      p2: `${ARP.G6} ${ARP.Em}`,
      tri: `${BASS.G} ${BASS.Em}`,
      noise: `${BEAT} ${BEAT}`,
    },
    A2: {
      p1: 'E5 - - - - - B4 - C5 - - - D5 - E5 - | A5 - - - G5 - - - F5 - E5 - C5 - - -',
      p2: `${ARP.Am9} ${ARP.Fmaj7}`,
      tri: `${BASS.Am} ${BASS.F}`,
      noise: `${CRASH} ${BEAT}`,
    },
    B2: {
      p1: 'F5 - - - E5 - D5 - A4 - - - D5 - F5 - | E5 - - - - - - - G#4 - - - B4 - D5 -',
      p2: `${ARP.Dm} ${ARP.E7}`,
      tri: `${BASS.Dm} ${BASS.E}`,
      noise: `${BEAT} ${FILL}`,
    },
    C: {
      p1: 'C6 - - - - - - - B5 - - - G5 - - - | A5 - - - - - - - - - - - E5 - - -',
      p2: `${ARP.Fmaj7} ${ARP.G6}`,
      tri: `${BASS.F} ${BASS.G}`,
      noise: `${CRASH} ${BEAT}`,
    },
    // Breakdown: the lead drops out over half-time drums, then climbs back in.
    D: {
      p2: `${ARP.Am9} ${ARP.Em}`,
      tri: `${BASS.Am} ${BASS.Em}`,
      noise: `${HALF} ${HALF}`,
    },
    D2: {
      p1: `${REST} E5 - - - G#5 - - - B5 - - - D6 - - -`,
      p2: `${ARP.Dm} ${ARP.E7}`,
      tri: `${BASS.Dm} ${BASS.E}`,
      noise: `${HALF} ${FILL}`,
    },
  },
  order: [
    'I',
    'A',
    'B',
    'A2',
    'B2',
    'A',
    'B',
    'C',
    'B2',
    'D',
    'D2',
    'A+5',
    'B+5',
    'A2+5',
    'B2+5',
    'C',
    'B2',
  ],
  loop: 1,
};
