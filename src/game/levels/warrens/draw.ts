import { BORER, ROCKFALL, WYRM } from '../../../content/levels/warrens';
import { boomSprite, BOOM_FRAMES } from '../../../gfx/fx';
import type { Renderer, SpriteOpts } from '../../../gfx/renderer';
import type { Enemy } from '../../../sim/types';
import type { DrawLayer, World } from '../../../sim/world';
import type { PartSlot } from '../../boss';
import { BORER_WARN } from './behaviors';
import { warrensState } from './state';
import { HEAD_CLOSED, HEAD_OPEN, TURRET_PIVOT, WR_SPRITES as SPR } from './warrens.sprites';
import { Motion, type Wyrm } from './wyrm';

const opts: SpriteOpts = { frame: 0, flash: false, rot: 0, alpha: 1, flipX: false };
const DUST = 'fx_dust';
const DUST_FRAMES = 4;
const SPARK_LIFE = 0.15;
const POP_LIFE = 0.5;
const SPARK_COLORS = ['#f8f8f8', '#f8e8a0', '#f8a030'] as const;
const GRIT = '#806040';
const GRIT_LIGHT = '#b09068';

function spr(
  r: Renderer,
  id: string,
  x: number,
  y: number,
  frame = 0,
  flash = false,
  rot = 0,
  flipX = false,
): void {
  opts.frame = frame;
  opts.flash = flash;
  opts.rot = rot;
  opts.flipX = flipX;
  r.sprite(id, x, y, opts);
}

/** A dust puff that grows through its four frames with `k` (0..1). */
function puff(r: Renderer, x: number, y: number, k: number): void {
  spr(r, DUST, x, y, Math.min(DUST_FRAMES - 1, Math.floor(k * DUST_FRAMES)));
}

// ---------------------------------------------------------------------------
// Roster.

export function drawTurret(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const flash = e.flashT > 0;
  const left = e.ax < 0;
  spr(r, SPR.turret, x, y, Math.floor(w.time * 2 + e.id) & 1, flash, 0, left);
  const px = x + (left ? -TURRET_PIVOT.x : TURRET_PIVOT.x);
  const p = w.player;
  // The barrel tracks the ship, but never swings back into its own wall.
  let rot = Math.atan2(p.x - px, -(p.y - y));
  if (e.ax > 0) rot = Math.max(0.15, Math.min(Math.PI - 0.15, rot));
  else rot = Math.min(-0.15, Math.max(-Math.PI + 0.15, rot));
  spr(r, SPR.turretGun, px, y, 0, flash, rot);
}

export function drawBorer(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  if (e.state <= BORER_WARN) {
    // The plume: dust bursting off the wall face, building over the warning.
    const k = Math.min(1, e.t / BORER.warn);
    const fx = e.ay;
    const out = e.ax;
    const n = 1 + Math.floor(k * 3);
    for (let i = 0; i < n; i++) {
      const jx = ((i * 5 + Math.floor(w.time * 12)) % 5) - 2;
      puff(r, fx + out * (2 + i * 3) + jx, y - 4 + i * 3, (k + i * 0.25) % 1);
    }
    if (Math.floor(w.time * 16) & 1) r.rect(Math.round(fx + out), Math.round(y), 1, 1, GRIT_LIGHT);
    return;
  }
  spr(r, SPR.borer, x, y, Math.floor(w.time * 14) & 1, e.flashT > 0, 0, e.ax < 0);
}

// ---------------------------------------------------------------------------
// The Wyrm.

function partXY(e: Enemy, alpha: number, out: { x: number; y: number }): void {
  out.x = e.prevX + (e.x - e.prevX) * alpha;
  out.y = e.prevY + (e.y - e.prevY) * alpha;
}

const pt = { x: 0, y: 0 };

export function drawWyrm(w: World, r: Renderer, alpha: number, b: Wyrm): void {
  const t = w.time;
  if (b.motion === Motion.Telegraph) {
    // The dust trail runs through the rock toward the exit point.
    const k = Math.min(1, b.motionT / WYRM.telegraph);
    for (let i = 0; i <= 5; i++) {
      const f = k * (i / 5);
      const x = b.tsx + (b.tex - b.tsx) * f;
      const y = Math.max(2, b.tsy + (b.tey - b.tsy) * f);
      if (x < -4 || x > w.width + 4) continue;
      puff(r, x, y, (t * 3 + i * 0.3) % 1);
    }
    const ey = Math.max(2, b.tey);
    for (let i = 0; i < 3; i++) {
      const a = t * 9 + i * 2.1;
      puff(r, b.tex + Math.cos(a) * 5 * k, ey + Math.sin(a) * 5 * k, k);
    }
    if (Math.floor(t * 20) & 1) {
      r.rect(Math.round(b.tex) - 1, Math.round(ey) - 1, 3, 3, GRIT);
      r.rect(Math.round(b.tex), Math.round(ey), 1, 1, GRIT_LIGHT);
    }
  } else if (b.motion === Motion.Dive) {
    puff(r, b.xx, Math.max(2, b.xy), (t * 4) % 1);
  }
  const slots = b.rig.slots;
  for (let s = slots.length - 1; s >= 0; s--) {
    if (b.vis[s] === 0) continue;
    const slot = slots[s] as PartSlot;
    const e = slot.enemy;
    if (e === null || !e.active) continue;
    partXY(e, alpha, pt);
    const flash = e.flashT > 0;
    if (s === 0) {
      spr(r, SPR.head, pt.x, pt.y, b.open ? HEAD_OPEN : HEAD_CLOSED, flash, b.rot[0]);
    } else {
      spr(r, SPR.seg, pt.x, pt.y, Math.floor(t * 6 + s * 0.5) & 1, flash, b.rot[s]);
    }
  }
  const sp = b.sparks;
  for (let i = 0; i < sp.length; i += 3) {
    const age = sp[i + 2] as number;
    if (age >= SPARK_LIFE) continue;
    const c = SPARK_COLORS[Math.min(2, Math.floor((age / SPARK_LIFE) * 3))] as string;
    r.rect(Math.round(sp[i] as number), Math.round(sp[i + 1] as number), 1, 1, c);
    r.rect(Math.round(sp[i] as number) + 1, Math.round(sp[i + 1] as number) - 1, 1, 1, c);
  }
  const pp = b.pops;
  for (let i = 0; i < pp.length; i += 3) {
    const age = pp[i + 2] as number;
    if (age >= POP_LIFE) continue;
    const f = Math.min(BOOM_FRAMES - 1, Math.floor((age / POP_LIFE) * BOOM_FRAMES));
    spr(r, boomSprite(32), pp[i] as number, pp[i + 1] as number, f);
  }
}

// ---------------------------------------------------------------------------
// The collapse: dust trickling from where a rock is about to fall.

export const rockfallLayer: DrawLayer = {
  name: 'warrens.rockfall',
  z: 41,
  draw(w, r) {
    const f = warrensState(w).falls;
    for (let i = 0; i < f.length; i += 3) {
      const left = f[i + 1] as number;
      if (left < 0) continue;
      const x = f[i] as number;
      const k = 1 - left / ROCKFALL.warn;
      puff(r, x, 3, k);
      // Grit streaks falling from the ceiling.
      for (let j = 0; j < 4; j++) {
        const y = ((w.time * 90 + j * 13) % 26) * k;
        const gx = x + ((j * 3) % 7) - 3;
        r.rect(Math.round(gx), Math.round(y), 1, 2, j & 1 ? GRIT : GRIT_LIGHT);
      }
    }
  },
};
