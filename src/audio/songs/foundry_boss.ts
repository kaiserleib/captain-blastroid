import { rep } from '../notes';
import type { SongDef } from '../song';
import { ACT2_SONG_BPM } from './bpm';

// The final boss, the Architect: F minor at 180 bpm, the fastest song. It
// quotes `armada_boss` note for note (patterns Q and Q2 are its A and B leads,
// in the same key), answers with the Foundry march motif (F1, `foundry`'s A
// lead moved to F minor), and climbs to a high-register climax. The drums mix
// armada_boss's beat with the Foundry's tom clanks. One loop is 32 bars ≈ 43 s.
const heavy = (lo: string, hi: string) =>
  `${lo} . ${lo} ${hi} ${lo} . ${lo} ${hi} ${lo} . ${lo} ${hi} ${lo} ${hi} ${lo} ${hi}`;
const ARP = {
  Fm: rep('F4 Ab4 C5 Ab4', 4),
  Db: rep('F4 Ab4 Db5 Ab4', 4),
  Eb: rep('G4 Bb4 Eb5 Bb4', 4),
  C: rep('E4 G4 C5 G4', 4),
};
const BASS = {
  Fm: heavy('F1', 'F2'),
  Db: heavy('Db2', 'Db3'),
  Eb: heavy('Eb2', 'Eb3'),
  C: heavy('C2', 'C3'),
};
const BEAT = 'k . t k s . t k k . t k s . s s';
const CRASH = 'c . t k s . t k k . t k s . s s';
const ROLL = 's s s s s s s s t t t t s s s s';
const DOUBLE = 'k t s t k t s t k t s t k k s s';

export const foundry_boss: SongDef = {
  id: 'foundry_boss',
  bpm: ACT2_SONG_BPM.foundry_boss,
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
  tri: { vol: 0.4, attack: 0.002, decay: 0.03, sustain: 0.85, release: 0.01 },
  drums: 0.5,
  patterns: {
    I: {
      tri: `${BASS.Fm} ${BASS.Fm}`,
      noise: `k . . . k . . . k . . . k . k . ${ROLL}`,
    },
    // armada_boss, A.
    Q: {
      p1: 'F5 - - F5 Ab5 - G5 - F5 - - - C5 - E5 - | F5 - - - Ab5 - Bb5 - C6 - - - Db6 - C6 -',
      p2: `${ARP.Fm} ${ARP.Db}`,
      tri: `${BASS.Fm} ${BASS.Db}`,
      noise: `${CRASH} ${BEAT}`,
    },
    // armada_boss, B.
    Q2: {
      p1: 'Bb5 - - - G5 - Eb5 - Bb5 - Ab5 - G5 - - - | E5 - - - - - - - G5 - - - C6 - Bb5 -',
      p2: `${ARP.Eb} ${ARP.C}`,
      tri: `${BASS.Eb} ${BASS.C}`,
      noise: `${BEAT} ${ROLL}`,
    },
    // The Foundry march motif.
    F1: {
      p1: 'F5 - - - C5 - - F5 Ab5 - - - G5 - F5 - | Eb5 - - - C5 - - - - - - - . . . .',
      p2: `${ARP.Fm} ${ARP.Eb}`,
      tri: `${BASS.Fm} ${BASS.Eb}`,
      noise: `${CRASH} ${BEAT}`,
    },
    F2: {
      p1: 'Db6 - - - C6 - Bb5 - Ab5 - - - Bb5 - C6 - | Db6 - - - - - - - Eb6 - - - E6 - - -',
      p2: `${ARP.Db} ${ARP.C}`,
      tri: `${BASS.Db} ${BASS.C}`,
      noise: `${BEAT} ${ROLL}`,
    },
    CL: {
      p1: 'F6 - - - - - - - E6 - - - C6 - - - | Ab6 - - - G6 - - - F6 - - - - - - -',
      p2: `${ARP.Fm} ${ARP.C}`,
      tri: `${BASS.Fm} ${BASS.C}`,
      noise: `${CRASH} ${DOUBLE}`,
    },
    BRK: {
      p2: `${ARP.Fm} ${ARP.Fm}`,
      tri: `${BASS.Fm} ${BASS.Fm}`,
      noise: `${DOUBLE} ${DOUBLE}`,
    },
  },
  order: [
    'I',
    'Q',
    'Q2',
    'F1',
    'F2',
    'Q',
    'Q2',
    'CL',
    'BRK',
    'F1',
    'F2',
    'Q+3',
    'Q2+3',
    'CL',
    'BRK',
    'Q',
    'CL',
  ],
  loop: 1,
};
