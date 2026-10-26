import type { Renderer, SpriteOpts } from '../../../gfx/renderer';
import { warm } from '../../../gfx/spriteCache';
import type { Anomaly, Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { muzzleY } from '../../enemies';
import { pulsarGapAngles, pulsarGapWidth, pulsarGlow } from '../../obstacles';
import { mem, RayPhase } from './behaviors';
import { MagPhase, type Magnetar } from './magnetar';
import {
  CORE_FRAMES,
  DRONE_FRAMES,
  HULL_RADIUS,
  PN_COLORS as COL,
  PN_SPRITE_IDS,
  PN_SPRITES as SPR,
  RAY_LENS_FRAMES,
  SPARK_FRAMES,
  WARN_FRAMES,
} from './pulsarNursery.sprites';

const opts: SpriteOpts = { frame: 0, flash: false };

function sprite(r: Renderer, id: string, x: number, y: number, frame = 0, flash = false): void {
  opts.frame = frame;
  opts.flash = flash;
  r.sprite(id, x, y, opts);
}

/** 1 px dots from `from` to `to` px along (ux, uy); `step` px apart, `phase` scrolls them. */
function dots(
  r: Renderer,
  cx: number,
  cy: number,
  ux: number,
  uy: number,
  from: number,
  to: number,
  step: number,
  phase: number,
  color: string,
): void {
  let lx = 1e9;
  let ly = 1e9;
  for (let d = from + (phase % step); d <= to; d += step) {
    const x = Math.round(cx + ux * d);
    const y = Math.round(cy + uy * d);
    if (x === lx && y === ly) continue;
    lx = x;
    ly = y;
    if (x < 0 || x >= 240 || y < 0 || y >= 400) continue;
    r.rect(x, y, 1, 1, color);
  }
}

// ---------------------------------------------------------------------------
// Roster draws (registerEnemyDraw; the defs have no sprite of their own)

export function drawDrone(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const m = mem(e);
  const blink = Math.floor((w.time + e.id * 0.37) * (m.charge > 0 ? 12 : 5)) & 1;
  sprite(
    r,
    SPR.drone,
    x,
    y,
    (m.charge > 0 ? DRONE_FRAMES.charge : DRONE_FRAMES.idle) + blink,
    e.flashT > 0,
  );
}

export function drawStreaker(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  if (e.state <= 1) {
    // Still under the edge: the launch warning blinks where it will come up.
    sprite(r, SPR.warn, x, 395, Math.floor(w.time * 10) % WARN_FRAMES);
    return;
  }
  sprite(r, SPR.streaker, x, y, Math.floor((w.time + e.id * 0.3) * 14) & 1, e.flashT > 0);
}

const DEG = Math.PI / 180;

export function drawRay(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const m = mem(e);
  sprite(r, SPR.ray, x, y, Math.floor((w.time + e.id * 0.37) * 4) & 1, e.flashT > 0);
  const my = muzzleY(e) + (y - e.y);
  let lens = 0;
  if (m.a === RayPhase.Telegraph) lens = 1 + Math.min(2, Math.floor(m.charge * 3));
  else if (m.a === RayPhase.On) lens = RAY_LENS_FRAMES - 1 - (Math.floor(w.time * 20) & 1);
  sprite(r, SPR.rayLens, x, my + 1, lens, e.flashT > 0);
  if (m.a !== RayPhase.Telegraph) return;
  // The fan it is about to sweep: the far edge (where it starts) bright, the
  // near edge (where it stops) dim, both growing out with the charge.
  const len = 30 + m.charge * 260;
  const ph = w.time * 40;
  const fa = m.far * DEG;
  const na = m.near * DEG;
  dots(r, x, my, Math.cos(fa), Math.sin(fa), 8, len, 4, ph, COL.rayLine);
  dots(r, x, my, Math.cos(na), Math.sin(na), 8, len, 6, ph, COL.rayLineDim);
  // A short arc at 24 px shows the sweep direction (far → near).
  for (let k = 0; k <= 6; k++) {
    const a = (m.far + ((m.near - m.far) * k) / 6) * DEG;
    if ((k + Math.floor(w.time * 8)) % 3 === 0) continue;
    r.rect(Math.round(x + Math.cos(a) * 24), Math.round(my + Math.sin(a) * 24), 1, 1, COL.rayLine);
  }
}

// ---------------------------------------------------------------------------
// Magnetar

const GAPS: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
const SPARK_LIFE = 0.15;
let warmed = false;

/**
 * Telegraph spokes past the hull rim: the anomaly layer's own spokes sit
 * under the station art, so the boss draws the upcoming gaps on top.
 */
function drawSpokes(r: Renderer, a: Anomaly, cx: number, cy: number, echo: boolean): void {
  const g = pulsarGlow(a);
  if (g <= 0) return;
  const n = pulsarGapAngles(a, GAPS);
  const half = pulsarGapWidth(a) / 2;
  const from = HULL_RADIUS + 1;
  const len = from + 6 + g * 40;
  for (let i = 0; i < n; i++) {
    const ang = GAPS[i] as number;
    const main = echo ? COL.echoSpoke : COL.spoke;
    dots(r, cx, cy, Math.cos(ang), Math.sin(ang), from, len, echo ? 2 : 0.7, 0, main);
    const el = from + (len - from) * 0.6;
    for (let s = -1; s <= 1; s += 2) {
      const e = ang + s * half;
      dots(r, cx, cy, Math.cos(e), Math.sin(e), from + 2, el, 1.4, 0, COL.spokeEdge);
    }
  }
}

function coreFrame(b: Magnetar, t: number): number {
  if (b.phase === MagPhase.Meltdown || b.phase === MagPhase.Dying)
    return CORE_FRAMES.melt + (Math.floor(t * 12) & 1);
  const s = b.shieldDown();
  if (s >= 1) return CORE_FRAMES.open + (Math.floor(t * 8) % CORE_FRAMES.openCount);
  if (b.shieldT >= 0) return CORE_FRAMES.crack + (s < 0.5 ? 0 : 1);
  return CORE_FRAMES.shield + (Math.floor(t * 3) & 1);
}

export function drawMagnetar(w: World, r: Renderer, alpha: number, b: Magnetar): void {
  if (!warmed) {
    warm(PN_SPRITE_IDS);
    warmed = true;
  }
  const rig = b.rig;
  const t = w.time;
  let bx = Math.round(rig.prevX + (rig.x - rig.prevX) * alpha);
  const by = Math.round(rig.prevY + (rig.y - rig.prevY) * alpha);
  const dying = b.phase === MagPhase.Dying;
  const strobe = dying && Math.floor(b.phaseT * 14) % 3 === 0;
  if (dying || b.phase === MagPhase.Meltdown)
    bx += Math.floor(b.phaseT * 30) % 2 === 0 ? 1 : dying ? -1 : 0;

  sprite(r, SPR.hull, bx, by, Math.floor(t * 3) & 1, strobe);

  // Field lines feeding the shield from each live pylon, crawling inward.
  const R = b.def.pylons.radius;
  if (b.shieldDown() < 1) {
    for (let i = 0; i < b.pylons.length; i++) {
      const s = b.pylons[i];
      if (s === undefined || s.destroyed || s.enemy === null) continue;
      const a = b.pylonAngle(i);
      const col = Math.floor(t * 6 + i) % 3 === 0 ? COL.fieldHot : COL.field;
      dots(r, bx, by, Math.cos(a), Math.sin(a), 15, R - 7, 3, -t * 18, col);
    }
  }

  for (let i = 0; i < b.pylons.length; i++) {
    const s = b.pylons[i];
    if (s === undefined) continue;
    const a = b.pylonAngle(i);
    const px = bx + Math.cos(a) * R;
    const py = by + Math.sin(a) * R;
    if (s.destroyed || s.enemy === null) {
      sprite(r, SPR.pylonWreck, px, py, Math.floor(t * 8 + i) & 1, strobe);
      continue;
    }
    const kick = (b.pylonFired[i] as number) < 0.1;
    sprite(
      r,
      SPR.pylon,
      px,
      py,
      kick ? 0 : Math.floor(t * 3 + i) & 1,
      strobe || s.enemy.flashT > 0,
    );
  }

  const core = b.core;
  const coreFlash = strobe || (core.enemy !== null && core.enemy.flashT > 0);
  sprite(r, SPR.core, bx, by, coreFrame(b, t), coreFlash);

  if (!dying) {
    const a = b.main();
    if (a !== null) drawSpokes(r, a, bx, by, false);
    const e = b.echo();
    if (e !== null) drawSpokes(r, e, bx, by, true);
  }

  const sp = b.sparks;
  for (let i = 0; i < sp.length; i += 3) {
    const age = sp[i + 2] as number;
    if (age >= SPARK_LIFE) continue;
    sprite(
      r,
      SPR.spark,
      sp[i] as number,
      sp[i + 1] as number,
      Math.min(SPARK_FRAMES - 1, Math.floor((age / SPARK_LIFE) * SPARK_FRAMES)),
    );
  }
}
