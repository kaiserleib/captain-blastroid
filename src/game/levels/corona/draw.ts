import { ROSTER } from '../../../content/levels/corona';
import type { Renderer, SpriteOpts } from '../../../gfx/renderer';
import { warm } from '../../../gfx/spriteCache';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { muzzleY } from '../../enemies';
import { isFlareBurning } from '../../obstacles';
import { lensCharge, LensPhase, mem, skimmerRot } from './behaviors';
import {
  ARM_SOCKETS,
  CO_COLORS as COL,
  CO_SPRITE_IDS,
  CO_SPRITES as SPR,
  CORE_FRAMES,
  GLINT_FRAMES,
  LENS_FRAMES,
  MIRROR_FRAMES,
  SKIMMER_FRAMES,
  SPARK_FRAMES,
} from './corona.sprites';
import { BeamState, HelioPhase, type Heliostat } from './heliostat';

const DEG = Math.PI / 180;
const opts: SpriteOpts = { frame: 0, flash: false, rot: 0 };

function sprite(
  r: Renderer,
  id: string,
  x: number,
  y: number,
  frame = 0,
  flash = false,
  rot = 0,
): void {
  opts.frame = frame;
  opts.flash = flash;
  opts.rot = rot;
  r.sprite(id, x, y, opts);
}

/** 1 px dots from `from` to `to` px along (ux, uy), `step` apart, scrolling with `phase`. */
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
  size = 1,
): void {
  let lx = 1e9;
  let ly = 1e9;
  for (let d = from + (((phase % step) + step) % step); d <= to; d += step) {
    const x = Math.round(cx + ux * d);
    const y = Math.round(cy + uy * d);
    if (x === lx && y === ly) continue;
    lx = x;
    ly = y;
    if (x < 0 || x >= 240 || y < 0 || y >= 400) continue;
    r.rect(x, y, size, size, color);
  }
}

// ---------------------------------------------------------------------------
// Roster

export function drawSkimmer(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const base = isFlareBurning(w) ? SKIMMER_FRAMES.burn : SKIMMER_FRAMES.idle;
  const f = base + (Math.floor((w.time + e.id * 0.3) * 10) & 1);
  sprite(r, SPR.skimmer, x, y, f, e.flashT > 0, skimmerRot(e));
}

export function drawShade(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const m = mem(e);
  // The eye flickers faster while it holds a strip.
  const f = Math.floor((w.time + e.id * 0.41) * (m.tucked ? 6 : 2)) & 1;
  sprite(r, SPR.shade, x, y, f, e.flashT > 0);
}

const LENS_P = ROSTER.co_lens?.behavior;
const LENS_TELEGRAPH =
  LENS_P !== undefined && LENS_P.kind === 'custom' ? (LENS_P.p?.telegraph ?? 0.6) : 0.6;

export function drawLens(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const m = mem(e);
  let f = LENS_FRAMES.idle + (Math.floor((w.time + e.id * 0.37) * 3) & 1);
  if (m.phase === LensPhase.Telegraph) f = LENS_FRAMES.charge;
  else if (m.phase === LensPhase.Beam) f = LENS_FRAMES.beam;
  sprite(r, SPR.lens, x, y, f, e.flashT > 0);
  if (m.phase !== LensPhase.Telegraph) return;
  // The focus line: it grows out to the locked aim and heats from red to white.
  const k = lensCharge(e, LENS_TELEGRAPH);
  const my = muzzleY(e) + (y - e.y);
  const a = m.heading * DEG;
  const col = k > 0.75 ? COL.lineHot : k > 0.35 ? COL.line : COL.lineDim;
  dots(r, x, my, Math.cos(a), Math.sin(a), 8, 40 + k * 380, k > 0.75 ? 2 : 4, w.time * 60, col);
}

// ---------------------------------------------------------------------------
// Heliostat

const SPARK_LIFE = 0.15;
const GLINT_LIFE = 1.6;
let warmed = false;

/** A 2 px arm from (x0, y0) to (x1, y1), lit along its top edge. */
function armLine(r: Renderer, x0: number, y0: number, x1: number, y1: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (dx * i) / n);
    const y = Math.round(y0 + (dy * i) / n);
    r.rect(x, y, 2, 2, COL.arm);
    r.rect(x, y, 1, 1, COL.armLight);
    r.rect(x + 1, y + 1, 1, 1, COL.armDark);
  }
}

function coreFrame(b: Heliostat, t: number): number {
  const pulse = Math.floor(t * (b.sinceRing < 0.1 ? 20 : 4)) & 1;
  if (b.phase === HelioPhase.Furnace || b.phase === HelioPhase.Dying)
    return CORE_FRAMES.furnace + pulse;
  if (b.core.targetable) return CORE_FRAMES.open + pulse;
  return CORE_FRAMES.shut + (Math.floor(t * 2) & 1);
}

export function drawHeliostat(w: World, r: Renderer, alpha: number, b: Heliostat): void {
  if (!warmed) {
    warm(CO_SPRITE_IDS);
    warmed = true;
  }
  const rig = b.rig;
  const t = w.time;
  let bx = Math.round(rig.prevX + (rig.x - rig.prevX) * alpha);
  const by = Math.round(rig.prevY + (rig.y - rig.prevY) * alpha);
  const dying = b.phase === HelioPhase.Dying;
  const strobe = dying && Math.floor(b.phaseT * 14) % 3 === 0;
  if (dying) bx += Math.floor(b.phaseT * 30) % 2 === 0 ? 1 : -1;
  const ox = bx - rig.x;
  const oy = by - rig.y;

  // Arms first, under the hull: socket → elbow → mirror.
  for (let i = 0; i < b.mirrors.length; i++) {
    const sock = ARM_SOCKETS[i];
    if (sock === undefined) continue;
    const sx = bx + sock[0];
    const sy = by + sock[1];
    const mx = Math.round(b.mirrorX(i) + ox);
    const my = Math.round(b.mirrorY(i) + oy);
    const ex = Math.round((sx + mx) / 2 + b.side(i) * 2);
    const ey = Math.round((sy + my) / 2 - 4);
    armLine(r, sx, sy, ex, ey);
    armLine(r, ex, ey, mx, my);
    r.rect(ex - 1, ey - 1, 3, 3, COL.joint);
  }

  sprite(r, SPR.hull, bx, by, Math.floor(t * 3) & 1, strobe);

  const core = b.core;
  const cx = bx + core.spec.ox;
  const cy = by + core.spec.oy;
  sprite(r, SPR.core, cx, cy, coreFrame(b, t), strobe || (core.enemy?.flashT ?? 0) > 0);

  for (let i = 0; i < b.mirrors.length; i++) {
    const s = b.mirrors[i];
    if (s === undefined) continue;
    const mx = Math.round(b.mirrorX(i) + ox);
    const my = Math.round(b.mirrorY(i) + oy);
    if (s.destroyed || s.enemy === null) {
      if (!dying) sprite(r, SPR.mirrorWreck, mx, my, Math.floor(t * 4 + i) & 1);
      continue;
    }
    const st = b.beam[i];
    let f = MIRROR_FRAMES.idle + (Math.floor(t * 2 + i * 0.5) & 1);
    if (st === BeamState.Telegraph) f = MIRROR_FRAMES.charge;
    else if (st === BeamState.On) f = MIRROR_FRAMES.beam;
    sprite(r, SPR.mirror, mx, my, f, strobe || s.enemy.flashT > 0);
    if (st === BeamState.Telegraph && !dying) drawTelegraph(w, r, b, i, mx, my);
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

  if (dying && b.glintT < GLINT_LIFE) {
    const g = b.glints;
    const k = b.glintT / GLINT_LIFE;
    for (let i = 0; i < b.glintN; i++) {
      // Each glint twinkles on its own beat and fades out through the frames.
      if ((Math.floor(t * 16) + i) % 3 === 0) continue;
      const f = Math.min(GLINT_FRAMES - 1, Math.floor(k * GLINT_FRAMES + (i % 2) * 0.5));
      sprite(r, SPR.glint, g[i * 4] as number, g[i * 4 + 1] as number, f);
    }
  }
}

/** Beam telegraph: the sweep's start line bright, its end line dim, a short arc between. */
function drawTelegraph(
  w: World,
  r: Renderer,
  b: Heliostat,
  i: number,
  mx: number,
  my: number,
): void {
  const from = b.from[i] as number;
  const to = b.to[i] as number;
  const ph = w.time * 50;
  const fa = from * DEG;
  const ta = to * DEG;
  dots(r, mx, my, Math.cos(fa), Math.sin(fa), 10, 420, 4, ph, COL.line);
  dots(r, mx, my, Math.cos(ta), Math.sin(ta), 10, 160, 7, ph, COL.lineDim);
  for (let k = 0; k <= 8; k++) {
    if ((k + Math.floor(w.time * 10)) % 3 === 0) continue;
    const a = (from + ((to - from) * k) / 8) * DEG;
    r.rect(Math.round(mx + Math.cos(a) * 20), Math.round(my + Math.sin(a) * 20), 1, 1, COL.line);
  }
}
