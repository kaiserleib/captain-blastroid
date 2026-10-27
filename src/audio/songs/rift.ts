import { rep } from '../notes';
import type { SongDef } from '../song';
import { ACT2_SONG_BPM } from './bpm';

// Sector 9, Chrono Rift: B minor at 96 bpm.
//
// Reversed envelopes: pulse 2's sustain is above 1, so after its short attack
// each arp note keeps swelling (vol → vol·sustain over the long decay) and is
// cut off at the end, like a tape played backwards. Its peak, vol·sustain,
// stays under level1's pulse-2 level.
//
// Tempo dips: the song has one tempo, so the "dips" are written in: DIP
// patterns halve the note rate and drop the drums to one kick a bar, which
// reads as time slowing before the groove snaps back. One loop is 32 bars = 80 s.
const rarp = (a: string, b: string, c: string, d: string) => rep(`${a} - ${b} - ${c} - ${d} -`, 2);
const slow = (a: string, b: string, c: string, d: string) =>
  `${a} - - - ${b} - - - ${c} - - - ${d} - - -`;
const hold = (n: string) => `${n} ${rep('-', 15)}`;
const ARP = {
  Bm: rarp('B3', 'D4', 'F#4', 'D4'),
  G: rarp('B3', 'D4', 'G4', 'D4'),
  Em: rarp('B3', 'E4', 'G4', 'E4'),
  Fs: rarp('A#3', 'C#4', 'F#4', 'C#4'),
  D: rarp('A3', 'D4', 'F#4', 'D4'),
};
const DR = 'k . . . h . . . s . . . h . . h';
const DR2 = 'k . . . h . k . s . . . h . h h';
const DIP = `k ${rep('.', 15)}`;
const R = rep('.', 16);

export const rift: SongDef = {
  id: 'rift',
  bpm: ACT2_SONG_BPM.rift,
  stepsPerBeat: 4,
  p1: {
    vol: 0.1,
    duty: 0.125,
    attack: 0.02,
    decay: 0.3,
    sustain: 0.7,
    release: 0.1,
    vibrato: 30,
    vibratoDelay: 0.3,
  },
  p2: { vol: 0.045, duty: 0.25, attack: 0.05, decay: 2, sustain: 2.2, release: 0.01 },
  tri: { vol: 0.4, attack: 0.02, decay: 0.3, sustain: 0.8, release: 0.1 },
  drums: 0.45,
  patterns: {
    I: {
      p2: `${ARP.Bm} ${ARP.Bm}`,
      tri: `${hold('B1')} ${hold('B1')}`,
      noise: `${DIP} ${DIP}`,
    },
    A: {
      p1: 'F#5 - - - - - - - E5 - - - D5 - - - | C#5 - - - - - - - - - - - . . . .',
      p2: `${ARP.Bm} ${ARP.Fs}`,
      tri: `${hold('B1')} ${hold('F#1')}`,
      noise: `${DR} ${DR2}`,
    },
    B: {
      p1: 'D5 - - - - - - - E5 - - - F#5 - - - | B5 - - - - - - - A5 - - - F#5 - - -',
      p2: `${ARP.G} ${ARP.D}`,
      tri: `${hold('G1')} ${hold('D2')}`,
      noise: `${DR} ${DR2}`,
    },
    C: {
      p1: 'G5 - - - - - - - F#5 - - - E5 - - - | F#5 - - - - - - - - - - - - - - -',
      p2: `${ARP.Em} ${ARP.Fs}`,
      tri: `${hold('E2')} ${hold('F#1')}`,
      noise: `${DR} ${DR2}`,
    },
    DIP1: {
      p1: `${hold('B5')} ${hold('A#5')}`,
      p2: `${slow('B3', 'D4', 'F#4', 'B4')} ${slow('A#3', 'C#4', 'F#4', 'C#5')}`,
      tri: `${hold('B1')} ${hold('F#1')}`,
      noise: `${DIP} ${DIP}`,
    },
    DIP2: {
      p2: `${slow('B3', 'D4', 'G4', 'B4')} ${slow('B3', 'E4', 'G4', 'B4')}`,
      tri: `${hold('G1')} ${hold('E2')}`,
      noise: `${DIP} ${R}`,
    },
  },
  order: [
    'I',
    'A',
    'B',
    'A',
    'C',
    'DIP1',
    'A',
    'B',
    'C',
    'DIP2',
    'A+5',
    'B+5',
    'A',
    'C',
    'DIP1',
    'DIP2',
    'C',
  ],
  loop: 1,
};
