import type { SongDef } from '../song';

// Three-bar victory fanfare; doesn't loop.
export const clear: SongDef = {
  id: 'clear',
  bpm: 140,
  stepsPerBeat: 4,
  p1: {
    vol: 0.18,
    duty: 0.25,
    attack: 0.004,
    decay: 0.1,
    sustain: 0.7,
    release: 0.08,
    vibrato: 20,
    vibratoDelay: 0.15,
  },
  p2: { vol: 0.16, duty: 0.5, attack: 0.004, decay: 0.1, sustain: 0.6, release: 0.08 },
  tri: { vol: 0.5, attack: 0.002, decay: 0.05, sustain: 0.9, release: 0.05 },
  drums: 0.6,
  patterns: {
    F: {
      p1:
        'G4 - C5 - E5 - G5 - - - E5 - G5 - - - | A5 - F5 - A5 - C6 - - - D6 - - - - - | ' +
        'E6 - - - - - - - - - - - . . . .',
      p2:
        'E4 - G4 - C5 - E5 - - - C5 - E5 - - - | F5 - C5 - F5 - A5 - - - B5 - - - - - | ' +
        'G5 - - - - - - - - - - - . . . .',
      tri:
        'C3 . . . C3 . . . G2 . . . C3 . . . | F2 . . . F2 . . . G2 . . . G2 . . . | ' +
        'C3 - - - - - - - . . . . . . . .',
      noise:
        'k . . . s . . . k . . . s . s s | k . . . s . . . k . k . s s s s | ' +
        'c . . . . . . . . . . . . . . .',
    },
  },
  order: ['F'],
  loop: -1,
};
