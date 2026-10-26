import { mix, OUTLINE, UI } from './palette';
import type { Renderer } from './renderer';
import { defineSprite } from './sprite';

// SNES windows band their gradients in visible steps rather than blending smoothly.
const BANDS = 12;
const WINDOW_BANDS: readonly string[] = Array.from({ length: BANDS }, (_, i) =>
  mix(UI.windowTop, UI.windowBottom, i / (BANDS - 1)),
);

/**
 * SNES menu window: 1 px gray outer border, 1 px white inner border, 2 px pixel-rounded
 * corners and a banded blue vertical gradient. (x, y, w, h) is the outer box. Min 6×6.
 */
export function drawWindow(r: Renderer, x: number, y: number, w: number, h: number): void {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.max(6, Math.round(w));
  h = Math.max(6, Math.round(h));
  const right = x + w - 1;
  const bottom = y + h - 1;

  // Gradient fill inside both borders.
  const innerH = h - 4;
  let row = 0;
  while (row < innerH) {
    const band = Math.floor((row * BANDS) / innerH);
    let end = row + 1;
    while (end < innerH && Math.floor((end * BANDS) / innerH) === band) end++;
    r.rect(x + 2, y + 2 + row, w - 4, end - row, WINDOW_BANDS[band] as string);
    row = end;
  }

  const outer = UI.borderOuter;
  r.rect(x + 2, y, w - 4, 1, outer);
  r.rect(x + 2, bottom, w - 4, 1, outer);
  r.rect(x, y + 2, 1, h - 4, outer);
  r.rect(right, y + 2, 1, h - 4, outer);
  r.rect(x + 1, y + 1, 1, 1, outer);
  r.rect(right - 1, y + 1, 1, 1, outer);
  r.rect(x + 1, bottom - 1, 1, 1, outer);
  r.rect(right - 1, bottom - 1, 1, 1, outer);

  const inner = UI.border;
  r.rect(x + 2, y + 1, w - 4, 1, inner);
  r.rect(x + 2, bottom - 1, w - 4, 1, inner);
  r.rect(x + 1, y + 2, 1, h - 4, inner);
  r.rect(right - 1, y + 2, 1, h - 4, inner);
  // Inner corner pixels round off the gradient's corners.
  r.rect(x + 2, y + 2, 1, 1, inner);
  r.rect(right - 2, y + 2, 1, 1, inner);
  r.rect(x + 2, bottom - 2, 1, 1, inner);
  r.rect(right - 2, bottom - 2, 1, 1, inner);
}

defineSprite('ui_cursor', {
  palette: { o: OUTLINE, w: UI.cursor, g: UI.textDim },
  frames: [
    `
    oo.....
    owo....
    owwo...
    owwgo..
    owgo...
    ogo....
    oo.....`,
  ],
  anchor: { x: 5, y: 3 },
});

/**
 * Menu arrow whose tip sits at (x, y): pass the left edge of the item it points at.
 * Blinks and nudges with `t` (seconds).
 */
export function drawCursor(r: Renderer, x: number, y: number, t: number): void {
  const phase = t * 4 - Math.floor(t * 4);
  if (phase > 0.8) return;
  const nudge = Math.floor(t * 2) % 2;
  r.sprite('ui_cursor', x - 1 - nudge, y);
}

export interface BarOpts {
  fill?: string;
  highlight?: string;
  back?: string;
  border?: string;
}

/** Horizontal meter with a 1 px border; the fill gets a highlight row on top. */
export function drawBar(
  r: Renderer,
  x: number,
  y: number,
  w: number,
  h: number,
  value: number,
  max: number,
  opts?: BarOpts,
): void {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  r.rect(x, y, w, h, opts?.border ?? OUTLINE);
  r.rect(x + 1, y + 1, w - 2, h - 2, opts?.back ?? UI.barBack);
  const t = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const fw = Math.round((w - 2) * t);
  if (fw <= 0) return;
  r.rect(x + 1, y + 1, fw, h - 2, opts?.fill ?? UI.barFill);
  if (h > 3) r.rect(x + 1, y + 1, fw, 1, opts?.highlight ?? UI.barHigh);
}
