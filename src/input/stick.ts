import type { Renderer } from '../gfx/renderer';

/** Full deflection distance and deadzone, CSS px (design.md, Controls). */
export const STICK_RADIUS_CSS = 40;
export const STICK_DEADZONE_CSS = 6;
/**
 * The stick base never spawns closer than this to the left/right screen edge, so a
 * touch there still has room to steer outward and keeps clear of Android's back gesture.
 */
export const STICK_EDGE_INSET_CSS = 16;

/** Floating stick, in playfield coords (logical buffer minus `playfieldOffsetY`). */
export interface StickState {
  active: boolean;
  pointerId: number;
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
  /** Deflection vector, length 0..1 after the deadzone. */
  x: number;
  y: number;
}

export function createStick(): StickState {
  return { active: false, pointerId: -1, baseX: 0, baseY: 0, knobX: 0, knobY: 0, x: 0, y: 0 };
}

export function stickDown(s: StickState, pointerId: number, x: number, y: number): void {
  s.active = true;
  s.pointerId = pointerId;
  s.baseX = s.knobX = x;
  s.baseY = s.knobY = y;
  s.x = s.y = 0;
}

/**
 * Finger moved to (x, y). Past the rim the base is towed so the knob stays on
 * it, which is what makes reversing direction instant (Vampire Survivors feel).
 * The deadzone is rescaled out so deflection ramps smoothly from 0 at its edge.
 */
export function stickMove(
  s: StickState,
  x: number,
  y: number,
  radius: number,
  deadzone: number,
): void {
  let dx = x - s.baseX;
  let dy = y - s.baseY;
  let len = Math.sqrt(dx * dx + dy * dy);
  if (len > radius) {
    const k = radius / len;
    dx *= k;
    dy *= k;
    s.baseX = x - dx;
    s.baseY = y - dy;
    len = radius;
  }
  s.knobX = x;
  s.knobY = y;
  if (len <= deadzone || radius <= deadzone) {
    s.x = s.y = 0;
    return;
  }
  const mag = (len - deadzone) / (radius - deadzone) / len;
  s.x = dx * mag;
  s.y = dy * mag;
}

export function stickRelease(s: StickState): void {
  s.active = false;
  s.pointerId = -1;
  s.x = s.y = 0;
}

const RING_DARK = '#182038';
const RING_LIGHT = '#a8c8f8';
const KNOB_DARK = '#283868';
const KNOB_LIGHT = '#d8e8f8';
const KNOB_R = 6;

/** Pixel rings via `r.circle` (midpoint, no anti-aliasing): a dark outline under a light ring. */
export function drawStick(r: Renderer, s: StickState, radius: number, opacity: number): void {
  if (!s.active || opacity <= 0) return;
  const ctx = r.ctx;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * opacity;
  const R = Math.max(KNOB_R + 2, Math.round(radius));
  r.circle(s.baseX, s.baseY, R + 1, RING_DARK, false);
  r.circle(s.baseX, s.baseY, R, RING_LIGHT, false);
  r.circle(s.baseX, s.baseY, R - 1, RING_DARK, false);
  r.circle(s.knobX, s.knobY, KNOB_R + 1, KNOB_DARK, true);
  r.circle(s.knobX, s.knobY, KNOB_R, KNOB_LIGHT, true);
  r.circle(s.knobX, s.knobY, KNOB_R - 2, RING_LIGHT, true);
  r.rect(s.knobX - 3, s.knobY - 3, 2, 1, '#f8f8f8');
  ctx.globalAlpha = prev;
}
