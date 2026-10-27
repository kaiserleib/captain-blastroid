import { BUBBLE_MINE_P, REWIND_P, STUTTER_P } from '../../../content/levels/chrono';
import type { Renderer, SpriteOpts } from '../../../gfx/renderer';
import { hasSprite } from '../../../gfx/sprite';
import { warm } from '../../../gfx/spriteCache';
import type { Enemy } from '../../../sim/types';
import type { DrawLayer, World } from '../../../sim/world';
import { STUTTER_FROZEN, rewindProgress, rewindTarget, stutterCharged } from './behaviors';
import {
  CLOCK_FRAMES,
  CR_SPRITE_IDS,
  CR_SPRITES as SPR,
  echoSpriteId,
  MINE_FRAMES,
  SHARD_FRAMES,
  STUTTER_FRAMES,
} from './chrono.sprites';
import { EchoPhase, type Echo, type Emitter } from './echo';
import { ECHO_R, SLOWB, AMBERR, H, L, B, D } from './paint';
import { peekChrono } from './state';

const opts: SpriteOpts = { frame: 0, flash: false, alpha: 1, rot: 0 };
const PT = { x: 0, y: 0 };
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const C_WHITE = hex(ECHO_R[H]);
const C_VIOLET = hex(ECHO_R[L]);
const C_DARK = hex(ECHO_R[D]);
const C_BLUE = hex(SLOWB[L]);
const C_BLUE_HI = hex(SLOWB[H]);
const C_AMBER = hex(AMBERR[L]);
const C_AMBER_DIM = hex(AMBERR[B]);
const SHARDS = 12;
const MUZZLE_T = 0.08;
let warmed = false;

function sprite(
  r: Renderer,
  id: string,
  x: number,
  y: number,
  frame = 0,
  flash = false,
  alpha = 1,
  rot = 0,
): void {
  opts.frame = frame;
  opts.flash = flash;
  opts.alpha = alpha;
  opts.rot = rot;
  r.sprite(id, x, y, opts);
}

// ---------------------------------------------------------------------------
// Roster draws (registerEnemyDraw, z 40 after the sprite).

export function drawStutterer(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const anim = Math.floor((w.time + e.id * 0.37) * 8) & 1;
  let f: number = STUTTER_FRAMES.move;
  if (e.state === STUTTER_FROZEN) f = STUTTER_FRAMES.freeze;
  else if (stutterCharged(e, STUTTER_P.ringEvery) && e.ax > STUTTER_P.burst * 0.25)
    f = STUTTER_FRAMES.charged;
  sprite(r, SPR.stutterer, x, y, f + anim, e.flashT > 0);
}

export function drawRewinder(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const k = rewindProgress(w, e, REWIND_P.warn);
  if (k < 0) return;
  // Where it will snap back to: a faint copy, brightening as the clock runs down.
  const tg = rewindTarget(w, e);
  if (tg !== null) sprite(r, SPR.rewinder, tg.tx, tg.ty, 0, false, 0.2 + 0.3 * k);
  // The hands spin backward, faster as the moment nears.
  const f = Math.floor(k * k * CLOCK_FRAMES * 3) % CLOCK_FRAMES;
  sprite(r, SPR.clock, x, y - 1, f);
}

export function drawMine(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const warn = e.t >= BUBBLE_MINE_P.fuse - BUBBLE_MINE_P.warn;
  const blink = Math.floor((w.time + e.id * 0.21) * (warn ? 10 : 3)) & 1;
  sprite(r, SPR.mine, x, y, (warn ? MINE_FRAMES.warn : MINE_FRAMES.idle) + blink, e.flashT > 0);
}

export function drawMissile(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const f = Math.floor((w.time + e.id * 0.3) * 12) & 1;
  sprite(r, SPR.missile, x, y, f, e.flashT > 0, 1, e.ax - Math.PI / 2);
}

// ---------------------------------------------------------------------------
// The echo pod (level layer, just under the pickups).

export const echoPodLayer: DrawLayer = {
  name: 'chrono.echoPod',
  z: 19,
  draw(w, r, alpha) {
    const p = peekChrono(w)?.pod;
    if (p === undefined || !p.active) return;
    const x = p.prevX + (p.x - p.prevX) * alpha;
    const y = p.prevY + (p.y - p.prevY) * alpha;
    const f = Math.floor(w.time * 2) & 1;
    // Two fading afterimages up its path, then the flickering ghost itself.
    for (let k = 2; k >= 1; k--) {
      const i = p.len - 1 - k * 24;
      if (i < 0) continue;
      sprite(
        r,
        SPR.pod,
        p.path[i * 2] as number,
        p.path[i * 2 + 1] as number,
        f,
        false,
        0.12 * (3 - k),
      );
    }
    const a = 0.45 + 0.15 * Math.sin(w.time * 9);
    sprite(r, SPR.pod, x, y, f, false, a);
  },
};

// ---------------------------------------------------------------------------
// The Echo (boss registry draw, z 42).

function dottedLine(
  r: Renderer,
  x: number,
  y: number,
  deg: number,
  len: number,
  gap: number,
  march: number,
  col: string,
  shade: string,
): void {
  const a = (deg * Math.PI) / 180;
  const cx = Math.cos(a);
  const cy = Math.sin(a);
  for (let s = march * gap; s < len; s += gap) {
    const px = Math.round(x + cx * s);
    const py = Math.round(y + cy * s);
    if (px < -2 || px > 242 || py < -2 || py > 402) break;
    r.rect(px, py + 1, 2, 1, shade);
    r.rect(px, py, 2, 1, col);
  }
}

/** A jagged bolt between two points; the kinks hash on the tick so the sim RNG stays untouched. */
function bolt(
  r: Renderer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tick: number,
  col: string,
): void {
  const n = 7;
  let px = x0;
  let py = y0;
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const h = Math.imul((tick >> 1) * 31 + i, 0x9e3779b1) >>> 0;
    const j = i === n ? 0 : ((h % 9) - 4) * 1.2;
    const nx = x0 + (x1 - x0) * u + j;
    const ny = y0 + (y1 - y0) * u + j * 0.5;
    const steps = Math.max(1, Math.ceil(Math.hypot(nx - px, ny - py) / 2));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      r.rect(Math.round(px + (nx - px) * t), Math.round(py + (ny - py) * t), 1, 1, col);
    }
    px = nx;
    py = ny;
  }
}

function drawTelegraphs(w: World, r: Renderer, b: Echo, em: Emitter, range: number): void {
  const t = w.time;
  if (em.lanceT >= 0) {
    const k = 1 - em.lanceT / b.def.patterns.lance.telegraph;
    const blink = k > 0.6 && Math.floor(t * 18) % 2 === 0;
    dottedLine(
      r,
      em.x,
      em.y + 2,
      em.lanceDeg,
      420,
      6,
      (t * 4) % 1,
      blink ? C_WHITE : C_VIOLET,
      C_DARK,
    );
  }
  const pl = w.player;
  const cy = em.y - b.def.muzzle;
  if (em.arcT >= 0) {
    // Crackle: the reach ring, sparks reaching for the ship.
    const blink = Math.floor(t * 20) % 2 === 0;
    r.circle(em.x, cy, range, blink ? C_AMBER : C_AMBER_DIM, false);
    if (pl.alive && Math.hypot(pl.x - em.x, pl.y - cy) < range + 14)
      bolt(r, em.x, cy + 8, pl.x, pl.y, w.tick, blink ? C_AMBER : C_AMBER_DIM);
  }
  if (em.zapT > 0) {
    if (em.zapHit && pl.alive) {
      bolt(r, em.x, cy + 8, pl.x, pl.y, w.tick + 3, C_WHITE);
      bolt(r, em.x + 1, cy + 8, pl.x + 1, pl.y, w.tick + 7, C_BLUE_HI);
    } else {
      r.circle(em.x, cy, range, C_WHITE, false);
    }
  }
  if (em.fired < MUZZLE_T) {
    r.rect(em.x - 2, em.y - 1, 4, 3, C_BLUE);
    r.rect(em.x - 1, em.y - 2, 2, 5, C_WHITE);
  }
}

export function drawEcho(w: World, r: Renderer, alpha: number, b: Echo): void {
  if (!warmed) {
    warm(CR_SPRITE_IDS);
    warmed = true;
  }
  const id = hasSprite(echoSpriteId(w.run.shipId))
    ? echoSpriteId(w.run.shipId)
    : echoSpriteId('kestrel');
  const rig = b.rig;
  const x = rig.prevX + (rig.x - rig.prevX) * alpha;
  const y = rig.prevY + (rig.y - rig.prevY) * alpha;
  const f = Math.floor(w.time * 10) & 1;
  const core = b.core.enemy;
  const flash = core !== null && core.flashT > 0;

  if (b.phase >= EchoPhase.Dying) {
    drawDeath(w, r, b, id, x, y, f);
    return;
  }

  // Afterimages: where it was a few ticks ago, fading.
  for (let k = 2; k >= 1; k--) {
    b.trailAt(k * 7, PT);
    sprite(r, id, PT.x, PT.y, f, false, 0.12 * (3 - k));
  }
  // The ghost: translucent, flickering.
  const g = b.ghost.enemy;
  if (g !== null && b.rig.alive(b.ghost)) {
    const gx = g.prevX + (g.x - g.prevX) * alpha;
    const gy = g.prevY + (g.y - g.prevY) * alpha;
    const a = 0.38 + 0.12 * Math.sin(w.time * 13);
    sprite(r, id, gx, gy, f, g.flashT > 0, a);
    drawTelegraphs(w, r, b, b.ghostE, b.def.patterns.arc.range);
  }
  sprite(
    r,
    id,
    x,
    y,
    f,
    flash,
    b.phase === EchoPhase.Entry ? 0.6 + 0.4 * Math.min(1, b.phaseT) : 1,
  );
  for (const s of b.drones) {
    const e = s.enemy;
    if (e === null || !b.rig.alive(s)) continue;
    const dx = e.prevX + (e.x - e.prevX) * alpha;
    const dy = e.prevY + (e.y - e.prevY) * alpha;
    sprite(r, SPR.drone, dx, dy, (Math.floor(w.time * 6) + e.id) & 1, e.flashT > 0);
  }
  drawTelegraphs(w, r, b, b.echoE, b.def.patterns.arc.range);
}

function drawDeath(
  w: World,
  r: Renderer,
  b: Echo,
  id: string,
  x: number,
  y: number,
  f: number,
): void {
  const stage = b.deathStage();
  if (stage === 0) {
    // Frozen: a white flash, then a still frame.
    sprite(r, id, x, y, 0, Math.floor(b.phaseT * 20) % 2 === 0);
    return;
  }
  if (stage === 1) {
    // Rewinding: afterimages trail ahead of it along the path it is unwinding.
    for (let k = 3; k >= 1; k--) {
      const u = Math.min(1, (b.phaseT - b.def.death.freeze) / b.def.death.rewind);
      b.trailAt(Math.max(0, Math.round(u * 60) - k * 6), PT);
      sprite(r, id, PT.x, PT.y, f, false, 0.1 * (4 - k));
    }
    sprite(r, id, x, y, f, Math.floor(w.time * 24) % 3 === 0);
    return;
  }
  const t = Math.max(0, b.shatterT);
  const k = t / b.def.death.shatter;
  if (k < 0.15) sprite(r, id, x, y, 0, true, 1 - k * 4);
  for (let i = 0; i < SHARDS; i++) {
    const a = (i / SHARDS) * Math.PI * 2 + i * 0.37;
    const v = 70 + ((i * 29) % 5) * 14;
    const sx = x + Math.cos(a) * v * t;
    const sy = y + Math.sin(a) * v * t + 30 * t * t;
    sprite(r, SPR.shard, sx, sy, (Math.floor(t * 14) + i) % SHARD_FRAMES, false, 1 - k * 0.8);
  }
}
