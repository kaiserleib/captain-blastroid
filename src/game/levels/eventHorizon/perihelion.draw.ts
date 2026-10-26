import type { Renderer, SpriteOpts } from '../../../gfx/renderer';
import { warm } from '../../../gfx/spriteCache';
import type { World } from '../../../sim/world';
import type { PartSlot } from '../../boss';
import { HZ_VIOLET, HZ_WARN } from './eventHorizon.sprites';
import { Dive, divePoint, PeriPhase, TRAIL, type Perihelion } from './perihelion';
import {
  HULL_FRAMES,
  PERI_CORE_FRAMES,
  PERI_SMOKE_FRAMES,
  PERI_SPARK_FRAMES,
  PERI_SPRITE_IDS,
  PERI_SPRITES as SPR,
} from './perihelion.sprites';

const opts: SpriteOpts = { frame: 0, flash: false, alpha: 1 };
const SPARK_LIFE = 0.15;
const MUZZLE_T = 0.1;
const BANK_VX = 28;
const PT = { x: 0, y: 0 };
let warmed = false;

function sprite(
  r: Renderer,
  id: string,
  x: number,
  y: number,
  frame = 0,
  flash = false,
  alpha = 1,
): void {
  opts.frame = frame;
  opts.flash = flash;
  opts.alpha = alpha;
  r.sprite(id, x, y, opts);
}

function smoke(r: Renderer, t: number, x: number, y: number, seed: number, n: number): void {
  for (let j = 0; j < n; j++) {
    const ph = (t * 0.9 + j / n + seed * 0.17) % 1;
    const wob = Math.sin((seed + j) * 2.3 + t * 1.7) * 2;
    sprite(r, SPR.smoke, x + wob, y - ph * 14, Math.floor(ph * PERI_SMOKE_FRAMES));
  }
}

function coreFrame(b: Perihelion, t: number): number {
  const F = PERI_CORE_FRAMES;
  if (b.phase === PeriPhase.Opening) {
    const k = Math.min(2, Math.floor((b.phaseT / b.def.coreOpenTime) * 3));
    return F.opening + k;
  }
  if (b.phase >= PeriPhase.Slingshot) return F.open + (Math.floor(t * 8) % F.openCount);
  return F.shut + (Math.floor(t * 3) % 2);
}

/**
 * The dive telegraph: a dotted curve from the boss's dive point, swinging
 * under the hole through the player's row and back up. The dots march along
 * the path and heat from red to white as the dive nears.
 */
function drawTelegraph(r: Renderer, b: Perihelion, t: number): void {
  const k = b.telegraph();
  if (k < 0) return;
  const blink = k > 0.75 && Math.floor(t * 16) % 2 === 0;
  const col = blink ? HZ_WARN.hot : k > 0.45 ? HZ_WARN.amber : HZ_WARN.red;
  const shade = k > 0.45 ? HZ_WARN.red : HZ_WARN.dim;
  // Reveal the path over the first quarter so it reads as "sweeping out".
  const reveal = Math.min(1, k * 4);
  const steps = 64;
  const march = (t * 3) % 1;
  for (let i = 0; i < steps; i++) {
    const u = (i + march) / steps;
    if (u > reveal) break;
    divePoint(b.path, u, PT);
    const x = Math.round(PT.x);
    const y = Math.round(PT.y);
    r.rect(x, y + 1, 2, 1, shade);
    r.rect(x, y, 2, 1, col);
  }
  // The crossing point at the bottom of the swing gets a bracket.
  divePoint(b.path, 0.5, PT);
  if (reveal >= 1) {
    const x = Math.round(PT.x);
    const y = Math.round(PT.y);
    r.rect(x - 7, y - 1, 3, 1, col);
    r.rect(x + 5, y - 1, 3, 1, col);
    r.rect(x - 7, y, 1, 2, col);
    r.rect(x + 7, y, 1, 2, col);
  }
}

function drawPod(
  r: Renderer,
  b: Perihelion,
  s: PartSlot,
  i: number,
  bx: number,
  by: number,
  t: number,
  strobe: boolean,
): void {
  const x = bx + s.spec.ox;
  const y = by + s.spec.oy;
  if (s.destroyed || s.enemy === null) {
    sprite(r, SPR.podWreck, x, y, Math.floor(t * 8 + i) % 2);
    smoke(r, t, x, y - 3, i * 3 + 1, 3);
    return;
  }
  const muzzle = (b.podFired[i] as number) < MUZZLE_T ? 1 : 0;
  sprite(r, SPR.pod, x, y, muzzle, strobe || s.enemy.flashT > 0);
}

/** Birth: violet rings converging on the hole while it grows. Death: a white flash and ring. */
function drawHoleFx(r: Renderer, b: Perihelion): void {
  if (b.phase === PeriPhase.Entry) {
    const g = b.phaseT / b.def.hole.growTime;
    if (g < 1) {
      for (let j = 0; j < 3; j++) {
        const rad = Math.round((1 - ((g * 1.5 + j / 3) % 1)) * 64);
        if (rad > 2) r.circle(b.hx, b.hy, rad, j === 0 ? HZ_VIOLET.light : HZ_VIOLET.base, false);
      }
    }
  }
  const c = b.collapseT;
  if (c < 0 || c > 0.7) return;
  if (c < 0.12) {
    // One bright frame-pair of the whole field going white.
    const ctx = r.ctx;
    ctx.globalAlpha = 0.55 * (1 - c / 0.12);
    r.rect(0, 0, 240, 400, '#f8f8f8');
    ctx.globalAlpha = 1;
  }
  const rad = Math.round(4 + c * 140);
  r.circle(b.hx, b.hy, rad, c < 0.3 ? '#f8f8f8' : HZ_VIOLET.highlight, false);
  if (rad > 10) r.circle(b.hx, b.hy, rad - 6, HZ_VIOLET.light, false);
}

/** Perihelion's `draw` (its registration in index.ts). */
export function drawPerihelion(w: World, r: Renderer, alpha: number, b: Perihelion): void {
  if (!warmed) {
    warm(PERI_SPRITE_IDS);
    warmed = true;
  }
  const rig = b.rig;
  const t = w.time;
  let bx = Math.round(rig.prevX + (rig.x - rig.prevX) * alpha);
  const by = Math.round(rig.prevY + (rig.y - rig.prevY) * alpha);
  const dying = b.phase === PeriPhase.Dying;
  const strobe = dying && Math.floor(b.phaseT * 14) % 3 === 0;
  if (dying) bx += Math.floor(b.phaseT * 30) % 2 === 0 ? 1 : -1;

  drawHoleFx(r, b);
  drawTelegraph(r, b, t);

  const flick = Math.floor(t * 12) % 2;
  const bank =
    rig.vx < -BANK_VX ? HULL_FRAMES.left : rig.vx > BANK_VX ? HULL_FRAMES.right : HULL_FRAMES.level;
  if (b.dive === Dive.Diving) {
    // Afterimages, oldest faintest.
    for (let j = 1; j < TRAIL; j++) {
      const i = (b.trailI - 1 - j + TRAIL * 2) % TRAIL;
      sprite(
        r,
        SPR.hull,
        b.trail[i * 2] as number,
        b.trail[i * 2 + 1] as number,
        bank + flick,
        false,
        0.45 - j * 0.12,
      );
    }
  }
  sprite(r, SPR.hull, bx, by, bank + flick, strobe);

  const core = b.core;
  const coreFlash = strobe || (core.enemy !== null && core.enemy.flashT > 0);
  sprite(r, SPR.core, bx + core.spec.ox, by + core.spec.oy, coreFrame(b, t), coreFlash);
  for (let i = 0; i < b.pods.length; i++)
    drawPod(r, b, b.pods[i] as PartSlot, i, bx, by, t, strobe);

  if (dying) {
    smoke(r, t, bx - 22, by - 2, 7, 3);
    smoke(r, t, bx + 20, by + 2, 11, 3);
    smoke(r, t, bx, by + 10, 5, 3);
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
      Math.min(PERI_SPARK_FRAMES - 1, Math.floor((age / SPARK_LIFE) * PERI_SPARK_FRAMES)),
    );
  }
}
