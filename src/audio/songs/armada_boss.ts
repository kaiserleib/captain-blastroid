import { rep } from '../notes';
import type { SongDef } from '../song';

// The final boss: F minor at 176 bpm, faster than `boss`. A driving octave
// bass on nearly every sixteenth, thin 12.5 % arps, and a lead that climbs
// through a Neapolitan G♭ before landing on the dominant. One loop is 32 bars ≈ 44 s.
const heavy = (lo: string, hi: string) =>
  `${lo} . ${lo} ${hi} ${lo} . ${lo} ${hi} ${lo} . ${lo} ${hi} ${lo} ${hi} ${lo} ${hi}`;
const ARP = {
  Fm: rep('F4 Ab4 C5 Ab4', 4),
  Db: rep('F4 Ab4 Db5 Ab4', 4),
  Eb: rep('G4 Bb4 Eb5 Bb4', 4),
  C: rep('E4 G4 C5 G4', 4),
  Bbm: rep('F4 Bb4 Db5 Bb4', 4),
  Gb: rep('Gb4 Bb4 Db5 Bb4', 4),
};
const BASS = {
  Fm: heavy('F1', 'F2'),
  Db: heavy('Db2', 'Db3'),
  Eb: heavy('Eb2', 'Eb3'),
  C: heavy('C2', 'C3'),
  Bbm: heavy('Bb1', 'Bb2'),
  Gb: heavy('Gb1', 'Gb2'),
};
const BEAT = 'k . h k s . h k k . h k s . s s';
const CRASH = 'c . h k s . h k k . h k s . s s';
const ROLL = 's s s s s s s s t t t t s s s s';
const DOUBLE = 'k h s h k h s h k h s h k k s s';

export const armada_boss: SongDef = {
  id: 'armada_boss',
  bpm: 176,
  stepsPerBeat: 4,
  p1: {
    vol: 0.15,
    duty: 0.25,
    attack: 0.003,
    decay: 0.06,
    sustain: 0.7,
    release: 0.03,
    vibrato: 25,
    vibratoDelay: 0.15,
  },
  p2: { vol: 0.09, duty: 0.125, attack: 0.002, decay: 0.04, sustain: 0.3, release: 0.01 },
  tri: { vol: 0.42, attack: 0.002, decay: 0.03, sustain: 0.85, release: 0.01 },
  drums: 0.55,
  patterns: {
    I: {
      tri: `${BASS.Fm} ${BASS.Fm}`,
      noise: `k . . . k . . . k . . . k . k . ${rep('s', 8)} ${rep('t', 8)}`,
    },
    A: {
      p1: 'F5 - - F5 Ab5 - G5 - F5 - - - C5 - E5 - | F5 - - - Ab5 - Bb5 - C6 - - - Db6 - C6 -',
      p2: `${ARP.Fm} ${ARP.Db}`,
      tri: `${BASS.Fm} ${BASS.Db}`,
      noise: `${CRASH} ${BEAT}`,
    },
    B: {
      p1: 'Bb5 - - - G5 - Eb5 - Bb5 - Ab5 - G5 - - - | E5 - - - - - - - G5 - - - C6 - Bb5 -',
      p2: `${ARP.Eb} ${ARP.C}`,
      tri: `${BASS.Eb} ${BASS.C}`,
      noise: `${BEAT} ${ROLL}`,
    },
    C: {
      p1: 'Db6 - - - C6 - Bb5 - F5 - - - Bb5 - Db6 - | Gb6 - - - - - - - F6 - - - Db6 - Bb5 -',
      p2: `${ARP.Bbm} ${ARP.Gb}`,
      tri: `${BASS.Bbm} ${BASS.Gb}`,
      noise: `${CRASH} ${BEAT}`,
    },
    D: {
      p1: 'Ab5 - - - - - - - Db6 - - - C6 - Bb5 - | C6 - - - - - - - - - - - E5 - G5 -',
      p2: `${ARP.Db} ${ARP.C}`,
      tri: `${BASS.Db} ${BASS.C}`,
      noise: `${BEAT} ${ROLL}`,
    },
    // Bass break: the lead drops out and the drums double up.
    E: {
      p2: `${ARP.Fm} ${ARP.Fm}`,
      tri: `${BASS.Fm} ${BASS.Fm}`,
      noise: `${DOUBLE} ${DOUBLE}`,
    },
  },
  order: [
    'I',
    'A',
    'B',
    'A',
    'B',
    'C',
    'D',
    'E',
    'E',
    'A+3',
    'B+3',
    'A+3',
    'B+3',
    'C',
    'D',
    'C',
    'D',
  ],
  loop: 1,
};
