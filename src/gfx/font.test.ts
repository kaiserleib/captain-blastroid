import { describe, expect, it } from 'vitest';
import { FONT_SMALL, FONT_UI, glyphFor, lineCount, measure } from './font';

describe('measure', () => {
  it('sums glyph widths plus 1 px spacing, without trailing spacing', () => {
    expect(measure('')).toBe(0);
    expect(measure('A')).toBe(4);
    expect(measure('AB')).toBe(9);
    expect(measure('MI')).toBe(5 + 1 + 3);
    expect(measure('A B')).toBe(4 + 1 + FONT_UI.spaceW + 1 + 4);
  });

  it('uses the widest line for multi-line text', () => {
    expect(measure('AB\nA')).toBe(9);
    expect(measure('A\nABC')).toBe(14);
    expect(lineCount('A\nB\nC')).toBe(3);
  });

  it('gives every digit the same width so numbers do not jitter', () => {
    for (const font of [FONT_UI, FONT_SMALL]) {
      const w = measure('0', font);
      for (let d = 0; d <= 9; d++) expect(measure(String(d), font)).toBe(w);
      expect(measure('1234567890', font)).toBe(measure('0000000000', font));
    }
  });

  it('measures the small font', () => {
    expect(measure('A', 'small')).toBe(3);
    expect(measure('SCORE', 'small')).toBe(3 * 5 + 4);
    expect(measure('score', 'small')).toBe(measure('SCORE', 'small'));
  });

  it('renders unknown chars as "?"', () => {
    expect(glyphFor(FONT_UI, '€'.charCodeAt(0))).toBe(glyphFor(FONT_UI, 63));
    expect(measure('€')).toBe(measure('?'));
  });
});

describe('glyphs', () => {
  it('covers the required set in both fonts', () => {
    const required = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!-+×/%()\'"<>←↑→↓⬢⬡▶';
    for (const font of [FONT_UI, FONT_SMALL]) {
      for (const ch of required) {
        expect(glyphFor(font, ch.charCodeAt(0)), `${font.id} "${ch}"`).not.toBe(font.fallback);
      }
    }
  });

  it('keeps every lit pixel inside the cell', () => {
    for (const font of [FONT_UI, FONT_SMALL]) {
      const glyphs = [...font.ascii, ...font.extra.values()];
      for (const g of glyphs) {
        if (!g) continue;
        for (let i = 0; i < g.bits.length; i += 2) {
          expect(g.bits[i]).toBeLessThan(g.w);
          expect(g.bits[i + 1]).toBeLessThan(font.cellH);
        }
      }
    }
  });
});
