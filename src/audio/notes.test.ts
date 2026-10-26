import { describe, expect, it } from 'vitest';
import {
  midiToFreq,
  noteLengths,
  noteToMidi,
  parseDrums,
  parseNotes,
  parseOrderEntry,
  rep,
  REST,
  TIE,
} from './notes';

describe('noteToMidi', () => {
  it('maps names, sharps and flats', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('C#5')).toBe(73);
    expect(noteToMidi('Db5')).toBe(73);
    expect(noteToMidi('Bb3')).toBe(58);
    expect(noteToMidi('B1')).toBe(35);
    expect(noteToMidi('c4')).toBe(60);
  });

  it('rejects junk', () => {
    expect(noteToMidi('H4')).toBeNaN();
    expect(noteToMidi('C')).toBeNaN();
    expect(noteToMidi('C##4')).toBeNaN();
  });
});

describe('midiToFreq', () => {
  it('is equal-tempered around A440', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(81)).toBeCloseTo(880);
    expect(midiToFreq(60)).toBeCloseTo(261.626, 2);
  });
});

describe('parseNotes', () => {
  it('parses notes, rests and ties, ignoring bar lines and spacing', () => {
    expect(parseNotes('C4 . E4 -  |  G4\n-')).toEqual([60, REST, 64, TIE, 67, TIE]);
  });

  it('throws on bad tokens so song typos fail tests', () => {
    expect(() => parseNotes('C4 X4')).toThrow(/X4/);
  });
});

describe('parseDrums', () => {
  it('maps drum letters', () => {
    expect(parseDrums('k . s h o c t')).toEqual([0, REST, 1, 2, 3, 4, 5]);
  });

  it('throws on unknown hits', () => {
    expect(() => parseDrums('k z')).toThrow(/z/);
  });
});

describe('noteLengths', () => {
  it('counts ties into the note they extend', () => {
    expect(noteLengths(parseNotes('C4 - - . E4 G4 -'))).toEqual([3, 0, 0, 0, 1, 2, 0]);
  });

  it('treats a tie after a rest as silence', () => {
    expect(noteLengths(parseNotes('. - C4'))).toEqual([0, 0, 1]);
  });
});

describe('parseOrderEntry', () => {
  it('splits a transpose suffix', () => {
    expect(parseOrderEntry('A')).toEqual({ pattern: 'A', transpose: 0 });
    expect(parseOrderEntry('B2+5')).toEqual({ pattern: 'B2', transpose: 5 });
    expect(parseOrderEntry('C-12')).toEqual({ pattern: 'C', transpose: -12 });
  });
});

describe('rep', () => {
  it('repeats with a single separator', () => {
    expect(rep('C4 .', 3)).toBe('C4 . C4 . C4 .');
  });
});
