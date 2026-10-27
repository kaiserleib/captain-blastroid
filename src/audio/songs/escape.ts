import { rep } from '../notes';
import type { SongDef } from '../song';
import { ACT2_SONG_BPM } from './bpm';

// The Foundry escape: D minor at 160 bpm. Kick on every beat, snare on every
// off-beat, an octave-bouncing bass on every eighth and a lead that keeps
// climbing. One loop is 32 bars = 48 s, longer than the 40 s countdown, so the
// player never hears it wrap.
const oct = (lo: string, hi: string) => rep(`${lo} ${hi}`, 8);
const ARP = {
  Dm: rep('D5 A4 F4 A4', 4),
  Bb: rep('D5 Bb4 F4 Bb4', 4),
  C: rep('E5 C5 G4 C5', 4),
  A: rep('E5 C#5 A4 C#5', 4),
  Gm: rep('D5 Bb4 G4 Bb4', 4),
};
const BASS = {
  Dm: oct('D2', 'D3'),
  Bb: oct('Bb1', 'Bb2'),
  C: oct('C2', 'C3'),
  A: oct('A1', 'A2'),
  Gm: oct('G1', 'G2'),
};
const RUN = 'k h s h k h s h k h s h k h s h';
const RUN2 = 'k h s h k h s h k h s h k s s s';
const CRASH = 'c h s h k h s h k h s h k h s h';
const ROLL = 's s s s s s s s t t t t s s s s';

export const escape: SongDef = {
  id: 'escape',
  bpm: ACT2_SONG_BPM.escape,
  stepsPerBeat: 4,
  p1: {
    vol: 0.14,
    duty: 0.25,
    attack: 0.003,
    decay: 0.06,
    sustain: 0.7,
    release: 0.03,
    vibrato: 20,
    vibratoDelay: 0.15,
  },
  p2: { vol: 0.08, duty: 0.125, attack: 0.002, decay: 0.04, sustain: 0.3, release: 0.01 },
  tri: { vol: 0.42, attack: 0.002, decay: 0.03, sustain: 0.8, release: 0.01 },
  drums: 0.5,
  patterns: {
    I: {
      p2: `${ARP.Dm} ${ARP.Dm}`,
      tri: `${BASS.Dm} ${BASS.Dm}`,
      noise: `${RUN} ${ROLL}`,
    },
    A: {
      p1: 'D5 - - - A5 - - - F5 - G5 - A5 - - - | Bb5 - - - A5 - G5 - F5 - - - E5 - - -',
      p2: `${ARP.Dm} ${ARP.C}`,
      tri: `${BASS.Dm} ${BASS.C}`,
      noise: `${CRASH} ${RUN2}`,
    },
    B: {
      p1: 'F5 - - - C6 - - - A5 - Bb5 - C6 - - - | D6 - - - C6 - Bb5 - A5 - - - C#6 - - -',
      p2: `${ARP.Bb} ${ARP.A}`,
      tri: `${BASS.Bb} ${BASS.A}`,
      noise: `${RUN} ${RUN2}`,
    },
    C: {
      p1: 'D6 - C6 - Bb5 - A5 - G5 - F5 - E5 - D5 - | C#5 - - - E5 - - - A5 - - - C#6 - - -',
      p2: `${ARP.Gm} ${ARP.A}`,
      tri: `${BASS.Gm} ${BASS.A}`,
      noise: `${CRASH} ${RUN2}`,
    },
    D: {
      p2: `${ARP.Dm} ${ARP.Bb}`,
      tri: `${BASS.Dm} ${BASS.Bb}`,
      noise: `${RUN} ${ROLL}`,
    },
  },
  order: [
    'I',
    'A',
    'B',
    'A',
    'C',
    'D',
    'A+2',
    'B+2',
    'A+2',
    'C+2',
    'D',
    'A',
    'B',
    'C',
    'A',
    'C',
    'D',
  ],
  loop: 1,
};
