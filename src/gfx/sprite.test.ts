import { describe, expect, it } from 'vitest';
import {
  anchorPoint,
  defineProcSprite,
  defineSprite,
  getSpriteEntry,
  gridRows,
  parseFrames,
  spriteIds,
  type PixelBuffer,
} from './sprite';

const PAL = { a: '#f80000', b: '#00f800' };

/** Reads a buffer back as a grid: '.' transparent, else the palette key for that color. */
function grid(buf: PixelBuffer): string[] {
  const rows: string[] = [];
  for (let y = 0; y < buf.h; y++) {
    let r = '';
    for (let x = 0; x < buf.w; x++) {
      const i = (y * buf.w + x) * 4;
      r += buf.data[i + 3] === 0 ? '.' : buf.data[i] === 0xf8 ? 'a' : 'b';
    }
    rows.push(r);
  }
  return rows;
}

describe('gridRows', () => {
  it('trims indentation and drops blank lines', () => {
    expect(gridRows('\n    ab.\n\n    .ba   \n  ')).toEqual(['ab.', '.ba']);
  });
});

describe('parseFrames', () => {
  it('parses colors and transparency', () => {
    const [f] = parseFrames('t', ['\n  ab\n  .a\n'], PAL);
    expect(f!.w).toBe(2);
    expect(f!.h).toBe(2);
    expect(grid(f!)).toEqual(['ab', '.a']);
    expect(Array.from(f!.data.slice(0, 4))).toEqual([0xf8, 0, 0, 255]);
  });

  it('pads ragged rows with transparency', () => {
    const [f] = parseFrames(
      't',
      [
        `
      aaaa
      a
      aa`,
      ],
      PAL,
    );
    expect(grid(f!)).toEqual(['aaaa', 'a...', 'aa..']);
  });

  it('pads every frame to the largest frame', () => {
    const frames = parseFrames('t', ['a', 'bb\nb'], PAL);
    expect(frames.map(grid)).toEqual([
      ['a.', '..'],
      ['bb', 'b.'],
    ]);
  });

  it('rejects unknown chars, naming the sprite and position', () => {
    expect(() => parseFrames('gnat', ['ab\naz'], PAL)).toThrow(
      /sprite "gnat": unknown char "z" at frame 0 row 1 col 1/,
    );
  });

  it('rejects bad palettes', () => {
    expect(() => parseFrames('p', ['a'], { a: 'red' })).toThrow(/sprite "p": bad color/);
    expect(() => parseFrames('p', ['a'], { aa: '#000000' })).toThrow(/one char/);
    expect(() => parseFrames('p', ['a'], { '.': '#000000' })).toThrow(/reserved/);
    expect(() => parseFrames('p', [], PAL)).toThrow(/no frames/);
  });

  it('mirrors the left half', () => {
    const [even] = parseFrames('m', ['ab\na'], PAL, true);
    expect(grid(even!)).toEqual(['abba', 'a..a']);
    const [odd] = parseFrames('m', ['ab\na'], PAL, 'odd');
    expect(grid(odd!)).toEqual(['aba', 'a.a']);
  });
});

describe('registry', () => {
  it('defines grid and procedural sprites; redefining replaces', () => {
    defineSprite('test_dot', { palette: PAL, frames: ['a', 'b'], rotations: 16 });
    expect(getSpriteEntry('test_dot')).toMatchObject({ kind: 'grid', w: 1, h: 1, frameCount: 2 });
    defineSprite('test_dot', { palette: PAL, frames: ['aa'] });
    expect(getSpriteEntry('test_dot')).toMatchObject({ w: 2, frameCount: 1, rotations: 0 });

    defineProcSprite('test_proc', 8, 6, () => {}, { frames: 3, outline: true });
    expect(getSpriteEntry('test_proc')).toMatchObject({
      kind: 'proc',
      w: 8,
      h: 6,
      frameCount: 3,
      outline: '#100818',
    });
    expect(spriteIds()).toEqual(expect.arrayContaining(['test_dot', 'test_proc']));
  });

  it('fails loudly at definition time', () => {
    expect(() => defineSprite('bad', { palette: PAL, frames: ['ax'] })).toThrow(/sprite "bad"/);
    expect(() => defineProcSprite('bad', 0, 4, () => {})).toThrow(/sprite "bad": bad size/);
  });
});

describe('anchorPoint', () => {
  it('resolves named anchors', () => {
    expect(anchorPoint('center', 24, 24)).toEqual({ x: 12, y: 12 });
    expect(anchorPoint('center', 5, 7)).toEqual({ x: 2.5, y: 3.5 });
    expect(anchorPoint('bottom', 6, 8)).toEqual({ x: 3, y: 8 });
    expect(anchorPoint({ x: 1, y: 2 }, 6, 8)).toEqual({ x: 1, y: 2 });
  });
});
