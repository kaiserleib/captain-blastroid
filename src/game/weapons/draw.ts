import { ARC_SHOW } from '../../content/weapons';
import type { Renderer, SpriteOpts } from '../../gfx/renderer';
import { GUNMETAL, PBULLET } from '../../gfx/palette';
import type { Bullet, WeaponInstance } from '../../sim/types';
import type { DrawLayer, World } from '../../sim/world';
import { droneAngle } from './drones';
import { MAX_BURSTS, MAX_SHELLS, weaponsState, type WeaponsState } from './state';
import { levelOf } from './weaponSystem';

const TICK_DT = 1 / 60;
const opts: SpriteOpts = { rot: 0, frame: 0 };
const droneOpts: SpriteOpts = { frame: 0 };

/** Seeker exhaust: a hot pixel, then two fading smoke puffs behind the missile. */
function drawTrail(r: Renderer, b: Bullet, x: number, y: number, tick: number): void {
  const len = Math.hypot(b.vx, b.vy);
  if (len === 0) return;
  const ux = b.vx / len;
  const uy = b.vy / len;
  r.rect(x - ux * 6, y - uy * 6, 1, 1, PBULLET.yellow);
  r.rect(x - ux * 8 - 1, y - uy * 8, 2, 2, GUNMETAL.highlight);
  if ((tick + b.id) & 2) r.rect(x - ux * 11, y - uy * 11, 1, 1, GUNMETAL.light);
}

const ARC_TICKS = Math.round(ARC_SHOW / TICK_DT);
/** Arc kinks: one every this many px of a link, jittered up to ±ARC_JITTER px. */
const ARC_KINK = 7;
const ARC_JITTER = 3;

/** Integer hash for render-only jitter: the sim RNG must never be touched by drawing. */
function hash(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f) ^ Math.imul(c + 0x165667b1, 0x9e3779b1);
  h ^= h >>> 13;
  return h >>> 0;
}

/** 1 px line, pixel by pixel (the renderer has no line primitive). */
function line(r: Renderer, x0: number, y0: number, x1: number, y1: number, color: string): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let i = 0; i <= n; i++) r.rect(x0 + (dx * i) / n, y0 + (dy * i) / n, 1, 1, color);
}

/** The last Arc Coil discharge: a jagged white-and-cyan polyline, re-jittered every 2 ticks. */
function drawArc(w: World, r: Renderer, s: WeaponsState): void {
  const age = w.tick - s.arcTick;
  if (s.arcTick < 0 || s.arcN < 2 || age >= ARC_TICKS) return;
  const seed = w.tick >> 1;
  const fading = age >= ARC_TICKS - 3;
  for (let j = 0; j + 1 < s.arcN; j++) {
    const ax = s.arcX[j] as number;
    const ay = s.arcY[j] as number;
    const bx = s.arcX[j + 1] as number;
    const by = s.arcY[j + 1] as number;
    const len = Math.hypot(bx - ax, by - ay);
    if (len === 0) continue;
    const px = -(by - ay) / len;
    const py = (bx - ax) / len;
    const kinks = Math.max(1, Math.floor(len / ARC_KINK));
    let lx = ax;
    let ly = ay;
    for (let k = 1; k <= kinks; k++) {
      const h = hash(seed, j, k);
      const t = k / kinks;
      const off = k === kinks ? 0 : ((h & 7) / 7) * 2 * ARC_JITTER - ARC_JITTER;
      const x = ax + (bx - ax) * t + px * off;
      const y = ay + (by - ay) * t + py * off;
      const color = fading || h & 8 ? PBULLET.cyan : PBULLET.white;
      line(r, lx, ly, x, y, color);
      lx = x;
      ly = y;
    }
    r.rect(bx - 1, by - 1, 3, 3, PBULLET.cyanLight);
  }
}

/** Flak shells in flight and fresh burst rings. */
function drawFlak(w: World, r: Renderer, s: WeaponsState, alpha: number): void {
  for (let i = 0; i < MAX_SHELLS; i++) {
    if (s.shellOn[i] === 0) continue;
    const px = s.shellPX[i] as number;
    const py = s.shellPY[i] as number;
    opts.rot = 0;
    opts.frame = 0;
    r.sprite(
      'pbullet_flak',
      px + ((s.shellX[i] as number) - px) * alpha,
      py + ((s.shellY[i] as number) - py) * alpha,
      opts,
    );
  }
  for (let i = 0; i < MAX_BURSTS; i++) {
    if (w.tick - (s.burstTick[i] as number) > 1) continue;
    r.circle(
      s.burstX[i] as number,
      s.burstY[i] as number,
      s.burstR[i] as number,
      PBULLET.white,
      false,
    );
  }
}

/** Every player shot, interpolated, plus the Act II weapons' effects. z 55. */
export const playerShotsLayer: DrawLayer = {
  name: 'playerShots',
  z: 55,
  draw(w, r, alpha) {
    const items = w.playerShots.items;
    const n = w.playerShots.count;
    const shimmer = w.tick >> 2;
    for (let i = 0; i < n; i++) {
      const b = items[i] as Bullet;
      if (!b.active) continue;
      const x = b.prevX + (b.x - b.prevX) * alpha;
      const y = b.prevY + (b.y - b.prevY) * alpha;
      if (b.sprite === '') {
        r.rect(x - 1, y - 2, 2, 4, PBULLET.cyan);
        continue;
      }
      if (b.homing > 0) drawTrail(r, b, x, y, w.tick);
      opts.rot = b.rot;
      opts.frame = shimmer + b.id;
      r.sprite(b.sprite, x, y, opts);
    }
    const s = weaponsState(w);
    drawFlak(w, r, s, alpha);
    drawArc(w, r, s);
  },
};

/** Orbit drones around the (interpolated) ship. z 58. */
export const dronesLayer: DrawLayer = {
  name: 'drones',
  z: 58,
  draw(w, r, alpha) {
    const p = w.player;
    if (!p.alive) return;
    const list = p.weapons;
    let inst: WeaponInstance | null = null;
    for (let i = 0; i < list.length; i++) {
      if ((list[i] as WeaponInstance).id === 'orbitDrones') inst = list[i] as WeaponInstance;
    }
    if (inst === null) return;
    const lv = levelOf(inst);
    if (lv === null) return;
    const px = p.prevX + (p.x - p.prevX) * alpha;
    const py = p.prevY + (p.y - p.prevY) * alpha;
    const a = inst.state - lv.orbitSpeed * TICK_DT * (1 - alpha);
    const n = lv.count;
    droneOpts.frame = w.tick >> 3;
    for (let i = 0; i < n; i++) {
      const da = droneAngle(a, i, n);
      r.sprite(
        lv.sprite,
        px + Math.cos(da) * lv.orbitRadius,
        py + Math.sin(da) * lv.orbitRadius,
        droneOpts,
      );
    }
  },
};
