// Act II hazard drawing. Flare light and shadow strips sit under every sprite
// (drawn first in the anomaly layer), so ships, shots and the rocks casting
// the shade stay crisp on top of the blow-out. Only rects and 2×2 / 4×4
// dither patterns: no per-pixel loops over the screen.
import { PORTAL } from '../../../content/obstacles';
import type { Renderer } from '../../../gfx/renderer';
import type { Bullet } from '../../../sim/types';
import { WORLD_H, WORLD_W, type World } from '../../../sim/world';
import type { Pool } from '../../../engine/pool';
import { bubbleScale, bubbleTimeScale, flipFlickering } from './bubbles';
import { flareProgress } from './flare';
import { portalColors } from './portals';
import { forEachStrip, type Strip } from './shade';
import { MAX_FLASHES, peekHz, type Bubble, type PortalEnd, type PortalPair } from './state';

// ---------------------------------------------------------------------------
// Dither patterns (built once per context, on first use)

type PatternKey = 'white50' | 'white25' | 'blow' | 'umber' | 'umber50';
const PATTERN_DEFS: Record<PatternKey, { n: number; on: readonly number[]; a: string; b: string }> =
  {
    // n×n cell; `on` lists the cells drawn in `a`, the rest in `b` ('' = clear).
    white50: { n: 2, on: [0, 3], a: '#f8f8f0', b: '' },
    white25: { n: 2, on: [0], a: '#f8f8f0', b: '' },
    blow: { n: 2, on: [0, 3], a: '#f8f8e8', b: '#f8e0a0' },
    umber: { n: 2, on: [0, 3], a: '#483020', b: '#281810' },
    umber50: { n: 2, on: [0, 3], a: '#382010', b: '' },
  };

const patterns = new WeakMap<
  CanvasRenderingContext2D,
  Partial<Record<PatternKey, CanvasPattern>>
>();

function pattern(r: Renderer, key: PatternKey): CanvasPattern | string {
  const ctx = r.ctx;
  let set = patterns.get(ctx);
  if (set === undefined) patterns.set(ctx, (set = {}));
  const hit = set[key];
  if (hit !== undefined) return hit;
  const d = PATTERN_DEFS[key];
  if (typeof document === 'undefined') return d.a;
  const c = document.createElement('canvas');
  c.width = c.height = d.n;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  for (let i = 0; i < d.n * d.n; i++) {
    const col = d.on.includes(i) ? d.a : d.b;
    if (col === '') continue;
    g.fillStyle = col;
    g.fillRect(i % d.n, Math.floor(i / d.n), 1, 1);
  }
  const p = ctx.createPattern(c, 'repeat');
  if (p === null) return d.a;
  set[key] = p;
  return p;
}

function fill(r: Renderer, key: PatternKey, x: number, y: number, w: number, h: number): void {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(WORLD_W, Math.round(x + w));
  const y1 = Math.min(WORLD_H, Math.round(y + h));
  if (x1 <= x0 || y1 <= y0) return;
  const ctx = r.ctx;
  ctx.fillStyle = pattern(r, key);
  ctx.fillRect(Math.round(x0 + r.shakeX), Math.round(y0 + r.offsetY + r.shakeY), x1 - x0, y1 - y0);
}

function withAlpha(r: Renderer, a: number): void {
  r.ctx.globalAlpha = a < 0 ? 0 : a > 1 ? 1 : a;
}

/** Cheap integer hash → 0..1, so draw-only noise never touches world.rng. */
function h01(i: number, salt: number): number {
  let x = Math.imul(i ^ Math.imul(salt, 0x9e3779b1), 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Flare

let stripR: Renderer | null = null;
let stripKey: PatternKey = 'umber';
let stripOutline = false;

const drawStrip = (s: Strip): boolean => {
  const r = stripR as Renderer;
  const h = s.bottom - s.top;
  fill(r, stripKey, s.left, s.top, s.right - s.left, h);
  if (stripOutline) {
    const l = Math.round(s.left);
    const t = Math.round(s.top);
    const w = Math.round(s.right) - l;
    const hh = Math.round(s.bottom) - t;
    r.rect(l, t, w, 1, '#f8f8f8');
    r.rect(l, t + hh - 1, w, 1, '#f8f8f8');
    r.rect(l, t, 1, hh, '#f8f8f8');
    r.rect(l + w - 1, t, 1, hh, '#f8f8f8');
  }
  return false;
};

function drawStrips(w: World, r: Renderer, key: PatternKey, outline: boolean): void {
  stripR = r;
  stripKey = key;
  stripOutline = outline;
  forEachStrip(w, drawStrip);
  stripR = null;
}

const SHIMMER = 40;

function drawWarn(w: World, r: Renderer, k: number): void {
  const ctx = r.ctx;
  // Amber tint over the whole field.
  withAlpha(r, 0.05 + 0.13 * k);
  r.rect(0, 0, WORLD_W, WORLD_H, '#f8a830');
  // Top edge whitening, creeping down as the burn nears.
  const band = 8 + 56 * k;
  withAlpha(r, 0.35 + 0.5 * k);
  r.rect(0, 0, WORLD_W, Math.round(band * 0.3), '#f8f8e8');
  ctx.globalAlpha = 1;
  fill(r, 'white50', 0, Math.round(band * 0.3), WORLD_W, Math.round(band * 0.35));
  fill(r, 'white25', 0, Math.round(band * 0.65), WORLD_W, Math.round(band * 0.35));
  // Heat shimmer: pixels rising off the bottom, more as it builds.
  const n = Math.round(SHIMMER * (0.3 + 0.7 * k));
  const t = w.time;
  for (let i = 0; i < n; i++) {
    const speed = 40 + 60 * h01(i, 2);
    const x = Math.floor(h01(i, 1) * WORLD_W);
    const y = WORLD_H - ((t * speed + h01(i, 3) * WORLD_H) % WORLD_H);
    const wob = Math.round(Math.sin(t * 9 + i) * 1.2);
    r.rect(x + wob, Math.floor(y), 1, 2, i & 1 ? '#f8e0a0' : '#f8c060');
  }
}

/** Light, shade strips and the warning, under every sprite. Called from the anomaly layer. */
export function drawFlareBackdrop(w: World, r: Renderer): void {
  const s = peekHz(w);
  if (s === undefined) return;
  const f = s.flare;
  if (f.phase === 'idle') return;
  const k = flareProgress(f);
  const ctx = r.ctx;
  if (f.phase === 'warn') {
    drawWarn(w, r, k);
    ctx.globalAlpha = 1;
    drawStrips(w, r, 'umber50', f.practice);
    return;
  }
  if (f.phase === 'cool' && f.fizzled) {
    withAlpha(r, 0.18 * (1 - k));
    r.rect(0, 0, WORLD_W, WORLD_H, '#f8a830');
    ctx.globalAlpha = 1;
    return;
  }
  // Burn (or its fade): blown out, with the strips cut back in as umber.
  const a = f.phase === 'burn' ? 1 : 1 - k;
  if (f.phase === 'burn' && f.t < 0.08) {
    r.rect(0, 0, WORLD_W, WORLD_H, '#f8f8f8');
  } else {
    withAlpha(r, 0.9 * a);
    fill(r, 'blow', 0, 0, WORLD_W, WORLD_H);
  }
  withAlpha(r, a);
  drawStrips(w, r, 'umber', f.practice && f.phase === 'burn');
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Slabs

const slabOpts = { frame: 0 };

export function drawSlabs(w: World, r: Renderer, alpha: number): void {
  const s = peekHz(w);
  if (s === undefined) return;
  for (let i = 0; i < s.slabCount; i++) {
    const sl = s.slabs[i]!;
    if (!sl.active) continue;
    r.sprite(
      'shade_slab',
      sl.prevX + (sl.x - sl.prevX) * alpha,
      sl.prevY + (sl.y - sl.prevY) * alpha,
      slabOpts,
    );
  }
}

// ---------------------------------------------------------------------------
// Bubbles

const SLOW = { ring: '#3880f8', inner: '#183c98', tick: '#a8d0f8' };
const FAST = { ring: '#f8a020', inner: '#884008', tick: '#f8e0a0' };
const TICKS = 12;
const STREAKS = 10;

function drawSlowLook(r: Renderer, cx: number, cy: number, R: number, t: number): void {
  r.circle(cx, cy, R, SLOW.ring, false);
  r.circle(cx, cy, R - 1, SLOW.inner, false);
  const rot = t * 0.25;
  for (let i = 0; i < TICKS; i++) {
    const a = rot + (i / TICKS) * Math.PI * 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const len = i % 3 === 0 ? 5 : 3;
    for (let d = 2; d < 2 + len; d++) {
      r.rect(Math.round(cx + ux * (R - d)), Math.round(cy + uy * (R - d)), 1, 1, SLOW.tick);
    }
  }
}

function drawFastLook(r: Renderer, cx: number, cy: number, R: number, t: number): void {
  r.circle(cx, cy, R, FAST.ring, false);
  r.circle(cx, cy, R - 1, FAST.inner, false);
  const span = Math.max(4, R - 8);
  for (let i = 0; i < STREAKS; i++) {
    const a = h01(i, 7) * Math.PI * 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    // Streaks rush inward from the rim.
    const d = R - 3 - ((t * 70 + h01(i, 8) * span) % span);
    for (let j = 0; j < 4; j++) {
      r.rect(Math.round(cx + ux * (d + j)), Math.round(cy + uy * (d + j)), 1, 1, FAST.tick);
    }
  }
}

function drawGhosts(w: World, r: Renderer, pool: Pool<Bullet>, color: string): void {
  const items = pool.items;
  for (let i = 0; i < pool.count; i++) {
    const b = items[i] as Bullet;
    if (!b.active) continue;
    if (bubbleTimeScale(w, b.x, b.y) >= 1) continue;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp < 1) continue;
    const ux = b.vx / sp;
    const uy = b.vy / sp;
    r.rect(Math.round(b.x - ux * 4), Math.round(b.y - uy * 4), 1, 1, color);
    r.rect(Math.round(b.x - ux * 7), Math.round(b.y - uy * 7), 1, 1, color);
  }
}

export function drawBubbles(w: World, r: Renderer, alpha: number): void {
  const s = peekHz(w);
  if (s === undefined || s.bubbleCount === 0) return;
  let anySlow = false;
  for (let i = 0; i < s.bubbleCount; i++) {
    const b = s.bubbles[i] as Bubble;
    if (!b.active) continue;
    const cx = Math.round(b.prevX + (b.x - b.prevX) * alpha);
    const cy = Math.round(b.prevY + (b.y - b.prevY) * alpha);
    let slow = bubbleScale(b) < 1;
    // Flip telegraph: alternate looks every few frames before the switch.
    if (b.kind === 'flip' && flipFlickering(b.t) && Math.floor(b.t * 15) % 2 === 1) slow = !slow;
    if (slow) drawSlowLook(r, cx, cy, b.r, b.t);
    else drawFastLook(r, cx, cy, b.r, b.t);
    if (bubbleScale(b) < 1) anySlow = true;
  }
  if (anySlow) {
    drawGhosts(w, r, w.enemyShots, '#a03878');
    drawGhosts(w, r, w.playerShots, '#3878a0');
  }
}

// ---------------------------------------------------------------------------
// Portals

const SWIRL_ARMS = 3;
const SWIRL_STEPS = 6;

function drawEnd(
  w: World,
  r: Renderer,
  e: PortalEnd,
  pal: readonly [string, string, string],
  t: number,
  alpha: number,
): void {
  const cx = Math.round(e.prevX + (e.x - e.prevX) * alpha);
  const cy = Math.round(e.prevY + (e.y - e.prevY) * alpha);
  if (cx < -PORTAL.r || cx > WORLD_W + PORTAL.r || cy < -PORTAL.r || cy > WORLD_H + PORTAL.r)
    return;
  const R = PORTAL.r;
  // Closed to the ship: drawn dim (dark ring, sparse swirl).
  const ring = e.open ? pal[1] : pal[0];
  r.circle(cx, cy, R, ring, false);
  r.circle(cx, cy, R - 1, ring, false);
  const rot = t * 4 * (e === e.pair.a ? 1 : -1);
  for (let arm = 0; arm < SWIRL_ARMS; arm++) {
    for (let st = 0; st < SWIRL_STEPS; st++) {
      const d = 2 + st * 2;
      const a = rot + (arm / SWIRL_ARMS) * Math.PI * 2 + st * 0.45;
      const x = Math.round(cx + Math.cos(a) * d);
      const y = Math.round(cy + Math.sin(a) * d);
      // Checker parity is the dither: the swirl shimmers as it turns.
      if (!e.open && ((x + y) & 1) === 1) continue;
      r.rect(x, y, 1, 1, ((x + y) & 1) === 0 ? pal[2] : pal[0]);
    }
  }
  if (e.open) {
    const ha = t * 2;
    r.rect(Math.round(cx + Math.cos(ha) * R), Math.round(cy + Math.sin(ha) * R), 1, 1, pal[2]);
  }
}

export function drawPortals(w: World, r: Renderer, alpha: number): void {
  const s = peekHz(w);
  if (s === undefined) return;
  for (let i = 0; i < s.pairCount; i++) {
    const p = s.pairs[i] as PortalPair;
    if (!p.active) continue;
    const pal = portalColors(p);
    drawEnd(w, r, p.a, pal, p.t, alpha);
    // Swap telegraph: the b end flickers to its new partner's color.
    let bPal = pal;
    const q = p.swapWith;
    if (p.swapT > 0 && q !== null && Math.floor(p.swapT * 12) % 2 === 0) bPal = portalColors(q);
    drawEnd(w, r, p.b, bPal, p.t, alpha);
  }
  for (let i = 0; i < MAX_FLASHES; i++) {
    if (w.tick - (s.flashTick[i] as number) > 1) continue;
    const x = Math.round(s.flashX[i] as number);
    const y = Math.round(s.flashY[i] as number);
    r.rect(x - 2, y - 2, 5, 5, '#f8f8f8');
    r.circle(x, y, 5, '#f8f8f8', false);
  }
}
