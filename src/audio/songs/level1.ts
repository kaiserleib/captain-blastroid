import { rep } from '../notes';
import type { SongDef } from '../song';

// Driving E minor (i–VI–VII–V), 150 bpm. One loop is 28 bars ≈ 44.8 s; the
// back half lifts a whole step to F♯ minor before dropping home.
const ARP = {
  Em: rep('E4 G4 B4 G4', 4),
  C: rep('C4 E4 G4 E4', 4),
  D: rep('D4 F#4 A4 F#4', 4),
  B: rep('B3 D#4 F#4 D#4', 4),
  Am: rep('A3 C4 E4 C4', 4),
};
const BASS = {
  Em: rep('E2 . E3 .', 4),
  C: rep('C2 . C3 .', 4),
  D: rep('D2 . D3 .', 4),
  B: rep('B1 . B2 .', 4),
  Am: rep('A1 . A2 .', 4),
};
const BEAT = 'k . h . s . h . k . k h s . h h';
const CRASH = 'c . h . s . h . k . k h s . h h';
const FILL = 'k . h . s . h . k . s s t t s s';
const HALF = 'k . . . h . . . s . . . h . . .';
const REST = rep('.', 16);

export const level1: SongDef = {
  id: 'level1',
  bpm: 150,
  stepsPerBeat: 4,
  p1: {
    vol: 0.28,
    duty: 0.5,
    attack: 0.004,
    decay: 0.08,
    sustain: 0.65,
    release: 0.04,
    vibrato: 15,
    vibratoDelay: 0.18,
  },
  p2: { vol: 0.1, duty: 0.25, attack: 0.002, decay: 0.05, sustain: 0.35, release: 0.015 },
  tri: { vol: 0.55, attack: 0.002, decay: 0.04, sustain: 0.85, release: 0.015 },
  drums: 0.6,
  patterns: {
    I: {
      p2: `${ARP.Em} ${ARP.Em}`,
      tri: `${BASS.Em} ${BASS.Em}`,
      noise: `k . h . k . h . k . h . k . h . ${FILL}`,
    },
    A: {
      p1: 'E5 - - . B4 - E5 - G5 - F#5 - E5 - D5 - | E5 - - - - - . . C5 - D5 - E5 - G5 -',
      p2: `${ARP.Em} ${ARP.C}`,
      tri: `${BASS.Em} ${BASS.C}`,
      noise: `${CRASH} ${BEAT}`,
    },
    B: {
      p1: 'F#5 - - . D5 - F#5 - A5 - G5 - F#5 - E5 - | D#5 - - - B4 - - - F#5 - - - D#5 - B4 -',
      p2: `${ARP.D} ${ARP.B}`,
      tri: `${BASS.D} ${BASS.B}`,
      noise: `${BEAT} ${BEAT}`,
    },
    B2: {
      p1: 'F#5 - - . D5 - F#5 - A5 - G5 - F#5 - E5 - | D#5 - - - F#5 - - - B5 - - - - - - -',
      p2: `${ARP.D} ${ARP.B}`,
      tri: `${BASS.D} ${BASS.B}`,
      noise: `${BEAT} ${FILL}`,
    },
    C: {
      p1: 'A5 - - - G5 - - - E5 - - - C5 - D5 - | E5 - - - - - - - B4 - - - - - - -',
      p2: `${ARP.Am} ${ARP.Em}`,
      tri: `${BASS.Am} ${BASS.Em}`,
      noise: `${CRASH} ${BEAT}`,
    },
    D: {
      p1: 'C5 - E5 - G5 - C6 - B5 - - - G5 - - - | A5 - - - F#5 - D5 - A5 - B5 - C6 - D6 -',
      p2: `${ARP.C} ${ARP.D}`,
      tri: `${BASS.C} ${BASS.D}`,
      noise: `${BEAT} ${FILL}`,
    },
    // Breakdown: the lead drops out over half-time drums, then a pickup back in.
    E: {
      p2: `${ARP.Em} ${ARP.C}`,
      tri: `${BASS.Em} ${BASS.C}`,
      noise: `${HALF} ${HALF}`,
    },
    E2: {
      p1: `${REST} B4 - - - D#5 - - - F#5 - - - A5 - B5 -`,
      p2: `${ARP.D} ${ARP.B}`,
      tri: `${BASS.D} ${BASS.B}`,
      noise: `${HALF} ${FILL}`,
    },
  },
  order: ['I', 'A', 'B', 'A', 'B2', 'C', 'D', 'C', 'D', 'E', 'E2+2', 'A+2', 'B+2', 'A+2', 'B2'],
  loop: 1,
};
