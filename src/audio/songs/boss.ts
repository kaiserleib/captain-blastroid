import { rep } from '../notes';
import type { SongDef } from '../song';

// Tense D minor at 168 bpm: syncopated bass ostinato, fast arps, and a lead
// that keeps leaning on the leading tone.
const bass = (lo: string, hi: string) =>
  `${lo} . ${lo} ${hi} . ${lo} ${lo} ${hi} ${lo} . ${lo} ${hi} . ${lo} ${hi} ${lo}`;
const ARP = {
  Dm: rep('D4 A4 D5 A4', 4),
  Bb: rep('D4 F4 Bb4 F4', 4),
  A: rep('C#4 E4 A4 E4', 4),
  Gm: rep('D4 G4 Bb4 G4', 4),
};
const BEAT = 'k . h k s . h k k . h k s . s s';
const CRASH = 'c . h k s . h k k . h k s . s s';
const ROLL = 's s s s s s s s t t t t s s s s';

export const boss: SongDef = {
  id: 'boss',
  bpm: 168,
  stepsPerBeat: 4,
  p1: {
    vol: 0.168,
    duty: 0.25,
    attack: 0.003,
    decay: 0.06,
    sustain: 0.75,
    release: 0.03,
    vibrato: 25,
    vibratoDelay: 0.15,
  },
  p2: { vol: 0.1, duty: 0.125, attack: 0.002, decay: 0.04, sustain: 0.3, release: 0.01 },
  tri: { vol: 0.6, attack: 0.002, decay: 0.03, sustain: 0.85, release: 0.01 },
  drums: 0.65,
  patterns: {
    I: {
      p2: `A4 ${rep('-', 15)} Bb4 ${rep('-', 15)}`,
      tri: `${bass('D2', 'D3')} ${bass('D2', 'D3')}`,
      noise: `k . . . k . . . k . . . k . . . s . s . s . s . ${rep('s', 8)}`,
    },
    A: {
      p1: 'D5 - . D5 F5 - E5 - D5 - . . A4 - C#5 - | D5 - . D5 F5 - G5 - A5 - - - Bb5 - A5 -',
      p2: `${ARP.Dm} ${ARP.Dm}`,
      tri: `${bass('D2', 'D3')} ${bass('D2', 'D3')}`,
      noise: `${CRASH} ${BEAT}`,
    },
    B: {
      p1: 'Bb5 - - - A5 - G5 - F5 - - - D5 - - - | E5 - - - C#5 - E5 - A5 - - - G#5 - - -',
      p2: `${ARP.Bb} ${ARP.A}`,
      tri: `${bass('Bb1', 'Bb2')} ${bass('A1', 'A2')}`,
      noise: `${BEAT} ${BEAT}`,
    },
    B2: {
      p1: 'Bb5 - A5 - G5 - F5 - E5 - F5 - G5 - A5 - | C#6 - - - - - - - A5 - - - E5 - C#5 -',
      p2: `${ARP.Bb} ${ARP.A}`,
      tri: `${bass('Bb1', 'Bb2')} ${bass('A1', 'A2')}`,
      noise: `${BEAT} ${ROLL}`,
    },
    C: {
      p1: 'G5 - - - Bb5 - - - D6 - - - C6 - Bb5 - | A5 - - - - - - - C#6 - - - E6 - - -',
      p2: `${ARP.Gm} ${ARP.A}`,
      tri: `${bass('G1', 'G2')} ${bass('A1', 'A2')}`,
      noise: `${CRASH} ${ROLL}`,
    },
  },
  order: ['I', 'A', 'B', 'A+5', 'B2', 'C', 'B2'],
  loop: 1,
};
