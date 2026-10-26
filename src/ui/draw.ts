import {
  NAMED_PORTRAITS,
  portraitCanvas,
  PORTRAIT_H,
  PORTRAIT_W,
  renderPortrait,
  type NamedPilotId,
} from '../portraits';
import { measure, type FontId } from '../gfx/font';
import { UI } from '../gfx/palette';
import type { Renderer } from '../gfx/renderer';
import { getCompiled } from '../gfx/spriteCache';
import { drawBar, drawCursor, drawWindow } from '../gfx/ui';
import type { MenuItem } from './menu';

export const GOLD = UI.textGold;
export const DIM = UI.textDim;
export const WHITE_TEXT = UI.text;
/** Single dark tone for locked silhouettes. */
export const SILHOUETTE = '#080818';
export const LOCK_RED = '#f86858';
export const OK_GREEN = '#78e878';

/** Darkens everything drawn so far (overlays over a frozen scene). */
export function dim(r: Renderer, alpha = 0.6): void {
  const ctx = r.ctx;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, r.width, r.height);
  ctx.globalAlpha = 1;
}

export interface ButtonOpts {
  focused: boolean;
  pressed?: boolean;
  /** Seconds, for the cursor blink. */
  t: number;
  color?: string;
  disabled?: boolean;
  /** Draws a value right-aligned inside the button (settings rows, costs). */
  value?: string;
  valueColor?: string;
  align?: 'center' | 'left';
}

/** A menu button: SNES window, label, blinking cursor when focused, 1 px press nudge. */
/** Minimum px between a button's label and its right-aligned value. */
const VALUE_GAP = 14;

export function drawButton(r: Renderer, it: MenuItem, label: string, o: ButtonOpts): void {
  const p = o.pressed ? 1 : 0;
  drawWindow(r, it.x, it.y + p, it.w, it.h);
  if (o.focused) {
    // Lighten the face so focus reads even between cursor blinks.
    r.ctx.globalAlpha = 0.18;
    r.rect(it.x + 2, it.y + 2 + p, it.w - 4, it.h - 4, '#f8f8f8');
    r.ctx.globalAlpha = 1;
  }
  const color = o.disabled ? DIM : (o.color ?? (o.focused ? GOLD : WHITE_TEXT));
  const ty = it.y + p + Math.floor((it.h - 8) / 2);
  const align = o.align ?? (o.value !== undefined ? 'left' : 'center');
  if (align === 'center') r.text(label, it.x + it.w / 2, ty, { align: 'center', color });
  else r.text(label, it.x + 12, ty, { color });
  if (o.value !== undefined) {
    // A long value (e.g. CAPTAIN BLASTROID) drops to the small font rather
    // than crowding the label; the small font sits 1 px lower to share a baseline.
    const labelEnd = it.x + 12 + measure(label);
    const right = it.x + it.w - 8;
    const fits = right - measure(o.value) - labelEnd >= VALUE_GAP;
    r.text(o.value, right, fits ? ty : ty + 1, {
      align: 'right',
      color: o.valueColor ?? color,
      font: fits ? 'ui' : 'small',
    });
  }
  if (o.focused) {
    const cx = align === 'center' ? it.x + it.w / 2 - measure(label) / 2 - 3 : it.x + 10;
    drawCursor(r, cx, ty + 4 + p, o.t);
  }
}

/** Screen title in a slim window across the top. */
export function drawHeader(r: Renderer, title: string, y: number, right?: string): void {
  drawWindow(r, 6, y, r.width - 12, 18);
  r.text(title, 14, y + 5, { color: GOLD });
  if (right) r.text(right, r.width - 14, y + 5, { align: 'right' });
}

/** Salvage amount with the HUD scrap icon, right-aligned at (x, y). */
export function drawSalvage(r: Renderer, amount: number, x: number, y: number): void {
  const s = String(amount);
  const w = measure(s);
  r.text(s, x, y, { align: 'right', color: GOLD });
  r.sprite('hud_scrap', x - w - 10, y - 1);
}

const tinted = new Map<string, HTMLCanvasElement>();

function tint(
  key: string,
  src: CanvasImageSource,
  w: number,
  h: number,
  color: string,
): HTMLCanvasElement {
  let c = tinted.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
  }
  tinted.set(key, c);
  return c;
}

/** Draws a sprite frame scaled by an integer, centred on its anchor; `silhouette` paints it one color. */
export function drawSpriteScaled(
  r: Renderer,
  id: string,
  x: number,
  y: number,
  scale: number,
  frame = 0,
  silhouette?: string,
): void {
  const c = getCompiled(id);
  if (!c) {
    r.sprite(id, x, y);
    return;
  }
  const sheet = silhouette
    ? tint(`${id}|${silhouette}`, c.sheet, c.sheet.width, c.sheet.height, silhouette)
    : c.sheet;
  const f = ((Math.floor(frame) % c.frames) + c.frames) % c.frames;
  const dx = Math.round(x + r.shakeX) - c.ox * scale;
  const dy = Math.round(y + r.offsetY + r.shakeY) - c.oy * scale;
  r.ctx.drawImage(sheet, f * c.w, 0, c.w, c.h, dx, dy, c.w * scale, c.h * scale);
}

export function portraitFor(pilotId: string): HTMLCanvasElement | null {
  const spec = NAMED_PORTRAITS[pilotId as NamedPilotId];
  return spec ? portraitCanvas(spec.seed, spec.overrides) : null;
}

const SILHOUETTE_PLATE = '#202c58';
const silhouettes = new Map<string, HTMLCanvasElement>();

/** The pilot's figure (head, hair, suit) in one dark tone over a plain plate. */
function silhouetteFor(pilotId: string): HTMLCanvasElement | null {
  let c = silhouettes.get(pilotId);
  if (c) return c;
  const spec = NAMED_PORTRAITS[pilotId as NamedPilotId];
  if (!spec) return null;
  const { mask } = renderPortrait(spec.seed, spec.overrides).pixels;
  c = document.createElement('canvas');
  c.width = PORTRAIT_W;
  c.height = PORTRAIT_H;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = SILHOUETTE_PLATE;
    ctx.fillRect(0, 0, PORTRAIT_W, PORTRAIT_H);
    ctx.fillStyle = SILHOUETTE;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) ctx.fillRect(i % PORTRAIT_W, Math.floor(i / PORTRAIT_W), 1, 1);
    }
  }
  silhouettes.set(pilotId, c);
  return c;
}

/** Pilot portrait with its top-left at (x, y); locked pilots draw as a flat silhouette. */
export function drawPortrait(
  r: Renderer,
  pilotId: string,
  x: number,
  y: number,
  scale: number,
  locked = false,
): void {
  const img = locked ? silhouetteFor(pilotId) : portraitFor(pilotId);
  if (!img) return;
  r.ctx.drawImage(
    img,
    Math.round(x),
    Math.round(y + r.offsetY),
    PORTRAIT_W * scale,
    PORTRAIT_H * scale,
  );
}

/** Greedy word wrap to `maxW` px. */
export function wrapText(str: string, maxW: number, font: FontId = 'ui'): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, font) > maxW) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

/** Slider track for a settings row: a bar in the right part of the button. */
export function sliderRect(it: MenuItem): { x: number; w: number } {
  const w = Math.min(84, Math.floor(it.w * 0.42));
  return { x: it.x + it.w - w - 40, w };
}

export function drawSliderRow(
  r: Renderer,
  it: MenuItem,
  label: string,
  value01: number,
  valueText: string,
  o: ButtonOpts,
): void {
  drawButton(r, it, label, { ...o, value: valueText });
  const s = sliderRect(it);
  drawBar(r, s.x, it.y + Math.floor(it.h / 2) - 3, s.w, 7, value01, 1, {
    fill: o.focused ? GOLD : UI.barFill,
    highlight: o.focused ? '#f8f0b0' : UI.barHigh,
  });
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
