// Shared pieces of the paged roster strips on Pilot Select and Ship Select.
import { LEVELS, LEVEL_ORDER } from '../content';
import type { Renderer } from '../gfx/renderer';
import { drawWindow } from '../gfx/ui';
import { DIM, GOLD, type MenuItem } from '../ui';

/** Entries visible per page of a roster strip. */
export const PER_PAGE = 4;

export function pageCount(n: number): number {
  return Math.max(1, Math.ceil(n / PER_PAGE));
}

export function pageOf(index: number): number {
  return Math.floor(Math.max(0, index) / PER_PAGE);
}

/** Display name of a sector, or ??? before its level exists. */
export function sectorName(levelId: string): string {
  return LEVELS[levelId]?.name ?? '???';
}

/** The first sector whose boss drops `shipId`'s schematic, or ??? if none does yet. */
export function schematicSector(shipId: string): string {
  for (const id of LEVEL_ORDER) {
    const l = LEVELS[id];
    if (l?.schematicOnClear.includes(shipId)) return l.name;
  }
  return '???';
}

/** One dot per page, the current one lit. */
export function drawPageDots(
  r: Renderer,
  cx: number,
  y: number,
  page: number,
  pages: number,
): void {
  const step = 10;
  const x0 = Math.round(cx - ((pages - 1) * step) / 2);
  for (let i = 0; i < pages; i++) {
    const x = x0 + i * step;
    r.rect(x - 3, y - 3, 6, 6, '#100818');
    r.rect(x - 2, y - 2, 4, 4, i === page ? GOLD : '#384078');
    if (i === page) r.rect(x - 2, y - 2, 2, 1, '#f8f8f8');
  }
}

/** A page-turn button: a small window with an arrow glyph, dimmed when there's nowhere to go. */
export function drawArrowButton(
  r: Renderer,
  it: MenuItem,
  dir: -1 | 1,
  o: { focused: boolean; pressed: boolean; enabled: boolean },
): void {
  const p = o.pressed ? 1 : 0;
  drawWindow(r, it.x, it.y + p, it.w, it.h);
  const color = !o.enabled ? DIM : o.focused ? GOLD : '#f8f8f8';
  r.text(dir < 0 ? '←' : '→', it.x + it.w / 2, it.y + Math.floor((it.h - 8) / 2) + p, {
    align: 'center',
    color,
  });
}

export function outline(r: Renderer, x: number, y: number, w: number, h: number, c: string): void {
  r.rect(x, y, w, 1, c);
  r.rect(x, y + h - 1, w, 1, c);
  r.rect(x, y, 1, h, c);
  r.rect(x + w - 1, y, 1, h, c);
}

/** Focus brackets: white corners that blink with the cursor rhythm. */
export function corners(
  r: Renderer,
  x: number,
  y: number,
  w: number,
  h: number,
  c: string,
  t: number,
): void {
  if (t * 4 - Math.floor(t * 4) >= 0.8) return;
  const L = 6;
  r.rect(x, y, L, 2, c);
  r.rect(x, y, 2, L, c);
  r.rect(x + w - L, y, L, 2, c);
  r.rect(x + w - 2, y, 2, L, c);
  r.rect(x, y + h - 2, L, 2, c);
  r.rect(x, y + h - L, 2, L, c);
  r.rect(x + w - L, y + h - 2, L, 2, c);
  r.rect(x + w - 2, y + h - L, 2, L, c);
}
