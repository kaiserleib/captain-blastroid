import { rep } from '../notes';
import type { SongDef } from '../song';

// Heroic, mid-tempo. C major with borrowed bVII/bVI chords; the gallop on
// pulse 2 does the "charging into battle" work.
const gallop = (n: string) => `${n} . . ${n} . . ${n} . ${n} . . ${n} . . ${n} .`;
const bass = (root: string, fifth: string) => `${root} - - - - - - . ${root} - - . ${fifth} - - .`;

const BEAT = 'k . h . s . h . k . h k s . h h';
const CRASH = 'c . h . s . h . k . h k s . h h';
const FILL = 'k . h . s . h . k . s . t t t t';

export const title: SongDef = {
  id: 'title',
  bpm: 116,
  stepsPerBeat: 4,
  p1: {
    vol: 0.3,
    duty: 0.25,
    attack: 0.005,
    decay: 0.12,
    sustain: 0.7,
    release: 0.06,
    vibrato: 18,
    vibratoDelay: 0.2,
  },
  p2: { vol: 0.13, duty: 0.125, attack: 0.002, decay: 0.06, sustain: 0.4, release: 0.02 },
  tri: { vol: 0.5, attack: 0.002, decay: 0.05, sustain: 0.9, release: 0.02 },
  drums: 0.55,
  patterns: {
    A: {
      p1: 'G4 - - C5 - - - - G5 - - - - - E5 - | F5 - - D5 - - Bb4 - - - - - D5 - F5 -',
      p2: `${gallop('E4')} ${gallop('F4')}`,
      tri: `${bass('C3', 'G2')} ${bass('Bb2', 'F2')}`,
      noise: `${CRASH} ${BEAT}`,
    },
    B: {
      p1: 'A5 - - - G5 - F5 - G5 - - - A5 - C6 - | B5 - - - - - - - G5 - A5 - B5 - D6 -',
      p2: `${gallop('A4')} ${gallop('B4')}`,
      tri: `${bass('F2', 'C2')} ${bass('G2', 'D2')}`,
      noise: `${BEAT} ${FILL}`,
    },
    C: {
      p1: 'C6 - - - - - - - - - - - G5 - E5 - | Eb5 - - - C5 - Eb5 - Ab5 - - - G5 - F5 -',
      p2: `${gallop('G4')} ${gallop('Eb4')}`,
      tri: `${bass('C3', 'G2')} ${bass('Ab2', 'Eb2')}`,
      noise: `${CRASH} ${BEAT}`,
    },
    D: {
      p1: 'D5 - - - F5 - Bb5 - D6 - - - C6 - Bb5 - | C6 - - - - - - - - - - - . . . .',
      p2: `${gallop('F4')} ${rep('E4 G4 C5 G4', 3)} . . . .`,
      tri: `${bass('Bb2', 'F2')} ${bass('C3', 'G2')}`,
      noise: `${BEAT} ${FILL}`,
    },
  },
  order: ['A', 'B', 'C', 'D'],
  loop: 0,
};
