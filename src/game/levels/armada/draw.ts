import { LEVIATHAN, MINE } from '../../../content/levels/armada';
import { boomSprite, BOOM_FRAMES, type BoomSize } from '../../../gfx/fx';
import type { Renderer, SpriteOpts } from '../../../gfx/renderer';
import { velocityRot } from '../../../sim/spawn';
import type { Enemy } from '../../../sim/types';
import type { DrawLayer, World } from '../../../sim/world';
import type { PartSlot } from '../../boss';
import {
  AR_SPRITES as SPR,
  BAY_FRAMES,
  conduitPath,
  GEN_FRAMES,
  HULL_SEGMENTS,
  hullSegmentId,
  SEG_H,
  SMOKE_FRAMES,
  SPARK_FRAMES,
} from './armada.sprites';
import { mineFrame } from './behaviors';
import { LevPhase, type Leviathan } from './leviathan';
import { armadaState, type FrigateWreck } from './state';

const L = LEVIATHAN;
const opts: SpriteOpts = { frame: 0, flash: false, rot: 0, alpha: 1, flipX: false };
const SPARK_LIFE = 0.15;
const POP_LIFE = 0.5;
const ION_COLORS = ['#30c0a0', '#90f8d0', '#f8f8f8', '#90f8d0'] as const;
const ION_DIM = '#106860';

function spr(
  r: Renderer,
  id: string,
  x: number,
  y: number,
  frame = 0,
  flash = false,
  rot = 0,
  alpha = 1,
): void {
  opts.frame = frame;
  opts.flash = flash;
  opts.rot = rot;
  opts.alpha = alpha;
  opts.flipX = false;
  r.sprite(id, x, y, opts);
}

/** Puffs rising off a fire at (x, y), drifting down with the hull; stateless, phased by `seed`. */
function smoke(r: Renderer, t: number, x: number, y: number, seed: number, n: number): void {
  for (let j = 0; j < n; j++) {
    const ph = (t * 0.9 + j / n + seed * 0.17) % 1;
    const wob = Math.sin((seed + j) * 2.3 + t * 1.7) * 2;
    spr(
      r,
      SPR.smoke,
      x + wob + ph * 3 * (j % 2 ? 1 : -1),
      y - ph * 14,
      Math.floor(ph * SMOKE_FRAMES),
    );
  }
}

function anchorOf(h: { anchorY: number; anchorPrevY: number }, alpha: number): number {
  return Math.round(h.anchorPrevY + (h.anchorY - h.anchorPrevY) * alpha);
}

// ---------------------------------------------------------------------------
// Hull deck (level layer, z 5: under pickups, rocks and every ship).

export const hullLayer: DrawLayer = {
  name: 'armada.hull',
  z: 5,
  draw(w, r, alpha) {
    const h = armadaState(w).hull;
    if (h === null) return;
    const ay = anchorOf(h, alpha);
    const t = w.time;
    const frame = Math.floor(t * 2) % 2;
    for (let k = 0; k < HULL_SEGMENTS; k++) {
      const cy = ay - k * SEG_H - SEG_H / 2;
      if (cy < -SEG_H / 2 - 2 || cy > w.height + SEG_H / 2 + 2) continue;
      spr(r, hullSegmentId(k), w.width / 2, cy, frame);
    }
    const stern = ay - L.length;
    if (stern < -20 || stern > w.height) return;
    if (!h.sunk) {
      // Engine plumes off the stern.
      const pf = Math.floor(t * 12) % 2;
      for (const ox of [-72, -30, 30, 72]) spr(r, SPR.plume, w.width / 2 + ox, stern - 6, pf);
    } else {
      for (let i = 0; i < 4; i++) smoke(r, t, w.width / 2 - 72 + i * 48, stern + 8, 20 + i, 3);
    }
  },
};

// ---------------------------------------------------------------------------
// The fight (boss registration draw, z 42).

function drawGun(
  r: Renderer,
  w: World,
  b: Leviathan,
  i: number,
  x: number,
  y: number,
  body: string,
  barrel: string,
  flash: boolean,
): void {
  const p = w.player;
  const a = Math.atan2(p.y - y, p.x - x);
  const kick = (b.firedT[i] as number) < 0.1 ? 2 : 0;
  spr(r, barrel, x - Math.cos(a) * kick, y - Math.sin(a) * kick, 0, flash, a - Math.PI / 2);
  spr(r, body, x, y, Math.floor(w.time * 3 + i) % 2, flash);
}

/** A crawling ion conduit from a live generator to the bridge, plus its shield shimmer. */
function drawConduit(r: Renderer, t: number, gx: number, ay: number, overloading: boolean): void {
  const c = conduitPath(gx);
  const y0 = ay - c.d0 - 12;
  const y1 = ay - c.d1;
  const phase = Math.floor(t * 30);
  for (let y = y0; y >= y1; y--) {
    const k = (phase + (y0 - y)) % 8;
    if (k > 3) continue;
    const col = overloading && phase % 3 === 0 ? ION_DIM : (ION_COLORS[k] as string);
    r.rect(gx, y, 1, 1, col);
  }
  const step = gx < c.x1 ? 1 : -1;
  for (let x = gx; x !== c.x1 + step; x += step) {
    const k = (phase + Math.abs(x - gx) + (y0 - y1)) % 8;
    if (k > 3) continue;
    r.rect(x, y1, 1, 1, ION_COLORS[k] as string);
  }
}

function drawShieldDome(r: Renderer, t: number, x: number, y: number): void {
  const n = 40;
  const rot = t * 0.6;
  for (let i = 0; i < n; i++) {
    if ((i + Math.floor(t * 10)) % 5 === 0) continue;
    const a = rot + (i / n) * Math.PI * 2;
    const px = Math.round(x + Math.cos(a) * 33);
    const py = Math.round(y + Math.sin(a) * 27);
    r.rect(px, py, 1, 1, i % 3 === 0 ? '#f8f8f8' : '#90f8d0');
  }
}

export function drawLeviathan(w: World, r: Renderer, alpha: number, b: Leviathan): void {
  const t = w.time;
  const ay = anchorOf(b, alpha);
  const cx = w.width / 2;
  const slots = b.rig.slots;
  const dying = b.phase === LevPhase.Dying;
  const strobe = dying && Math.floor(b.phaseT * 14) % 3 === 0;

  // Generator conduits and the bridge shield while any generator lives.
  if (b.genAlive) {
    for (const i of b.genI) {
      const s = slots[i] as PartSlot;
      if (!b.rig.alive(s)) continue;
      const warn = (b.onT[i] as number) > L.gen.overloadAfter - L.gen.warn;
      drawConduit(r, t, cx + s.spec.ox, ay, warn);
    }
  }

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i] as PartSlot;
    const kind = b.kind(i);
    if (kind === 'core' || kind === 'bridge' || b.passed[i]) continue;
    const x = cx + s.spec.ox;
    const y = ay + s.spec.oy;
    if (y < -30 || y > w.height + 30) continue;
    if (s.destroyed || s.enemy === null) {
      spr(r, SPR.wreck, x, y, Math.floor(t * 8 + i) % 2);
      smoke(r, t, x, y - 2, i * 3 + 1, 3);
      continue;
    }
    const e = s.enemy;
    const flash = strobe || e.flashT > 0;
    switch (kind) {
      case 'flak':
        drawGun(r, w, b, i, x, y, SPR.flak, SPR.barrelSingle, flash);
        break;
      case 'deck':
        drawGun(r, w, b, i, x, y, SPR.deck, SPR.barrelTwin, flash);
        break;
      case 'gun':
        drawGun(r, w, b, i, x, y, SPR.gun, SPR.barrelSingle, flash);
        break;
      case 'armor':
        spr(r, SPR.armor, x, y, 0, strobe);
        break;
      case 'bay': {
        const left = b.bayCountdown(i);
        let f: number = BAY_FRAMES.shut;
        if ((b.firedT[i] as number) < 0.5) f = BAY_FRAMES.empty;
        else if (left < L.bay.telegraph * 0.5) f = BAY_FRAMES.armed;
        else if (left < L.bay.telegraph) f = BAY_FRAMES.cracking;
        spr(r, SPR.bay, x, y, f, flash);
        break;
      }
      case 'gen': {
        const warn = (b.onT[i] as number) > L.gen.overloadAfter - L.gen.warn;
        const sputter = warn && Math.floor(t * 18) % 2 === 0;
        spr(r, SPR.gen, x, y, Math.floor(t * 8) % GEN_FRAMES, flash || sputter);
        break;
      }
    }
  }

  // Bridge (whole, or the burning wreck once the core is out).
  const by = ay + b.bridge.spec.oy;
  if (by > -40 && by < w.height + 40) {
    const be = b.bridge.enemy;
    const broken = b.phase >= LevPhase.Launch;
    if (broken) {
      spr(r, SPR.bridgeWreck, cx, by, Math.floor(t * 6) % 2, strobe);
      smoke(r, t, cx - 12, by - 6, 3, 4);
      smoke(r, t, cx + 14, by + 2, 9, 4);
    } else {
      spr(r, SPR.bridge, cx, by, Math.floor(t * 2) % 2, strobe || (be !== null && be.flashT > 0));
      if (b.genAlive && by > 0) drawShieldDome(r, t, cx, by);
    }
  }

  // Escape core, once it lifts off.
  if (b.phase >= LevPhase.Launch && b.phase <= LevPhase.Dying) {
    const c = b.core.enemy;
    const x = Math.round(b.corePrevX + (b.coreX - b.corePrevX) * alpha);
    const y = Math.round(b.corePrevY + (b.coreY - b.corePrevY) * alpha);
    const flash = strobe || (c !== null && c.flashT > 0);
    spr(r, SPR.core, x, y, Math.floor(t * 12) % 2, flash);
  }

  const sp = b.sparks;
  for (let i = 0; i < sp.length; i += 3) {
    const age = sp[i + 2] as number;
    if (age >= SPARK_LIFE) continue;
    spr(
      r,
      SPR.spark,
      sp[i] as number,
      sp[i + 1] as number,
      Math.min(SPARK_FRAMES - 1, Math.floor((age / SPARK_LIFE) * SPARK_FRAMES)),
    );
  }
  drawPops(r, b);
}

function drawPops(r: Renderer, b: Leviathan): void {
  const pp = b.pops;
  for (let i = 0; i < pp.length; i += 4) {
    const age = pp[i + 2] as number;
    if (age >= POP_LIFE) continue;
    const size = pp[i + 3] as BoomSize;
    spr(
      r,
      boomSprite(size),
      pp[i] as number,
      pp[i + 1] as number,
      Math.min(BOOM_FRAMES - 1, Math.floor((age / POP_LIFE) * BOOM_FRAMES)),
    );
  }
}

/** z 43: the wreck's last pops and fires while it drifts away (the boss draw has stopped). */
export const sunkLayer: DrawLayer = {
  name: 'armada.sunk',
  z: 43,
  draw(w, r, alpha) {
    const h = armadaState(w).hull as Leviathan | null;
    if (h === null || !h.sunk) return;
    const ay = anchorOf(h, alpha);
    const by = ay + h.bridge.spec.oy;
    const t = w.time;
    // Every mount is a burnt-out socket now; the armor slabs stay bolted down.
    for (let i = 0; i < h.specs.length; i++) {
      const k = h.kind(i);
      if (k === 'bridge' || k === 'core') continue;
      const y = ay + (h.specs[i] as { oy: number }).oy;
      if (y < -20 || y > w.height + 20) continue;
      const x = w.width / 2 + (h.specs[i] as { ox: number }).ox;
      if (k === 'armor') spr(r, SPR.armor, x, y);
      else spr(r, SPR.wreck, x, y, Math.floor(t * 8 + i) % 2);
    }
    drawPops(r, h);
    if (by < w.height + 40) {
      spr(r, SPR.bridgeWreck, w.width / 2, by, Math.floor(t * 6) % 2);
      smoke(r, t, w.width / 2 - 12, by - 6, 3, 4);
      smoke(r, t, w.width / 2 + 14, by + 2, 9, 4);
    }
    for (let i = 0; i < 6; i++) {
      const y = ay - 120 - i * 110;
      if (y < -20 || y > w.height + 20) continue;
      smoke(r, t, w.width / 2 + ((i * 67) % 140) - 70, y, 30 + i, 3);
    }
  },
};

// ---------------------------------------------------------------------------
// Frigate wrecks (z 39, under live ships): the broken hull burns and sinks
// away below the fleet, fading out.

export const WRECK_LIFE = 3;

export const wreckLayer: DrawLayer = {
  name: 'armada.wrecks',
  z: 39,
  draw(w, r, alpha) {
    const ws = armadaState(w).wrecks;
    const t = w.time;
    for (let i = 0; i < ws.length; i++) {
      const k = ws[i] as FrigateWreck;
      if (!k.active) continue;
      const x = k.prevX + (k.x - k.prevX) * alpha;
      const y = k.prevY + (k.y - k.prevY) * alpha;
      const fade = Math.max(0, Math.min(1, (WRECK_LIFE - k.t) / 1.2));
      opts.frame = Math.floor(t * 6 + i) % 2;
      opts.flash = false;
      opts.rot = 0;
      opts.alpha = fade;
      opts.flipX = k.flip;
      r.sprite(SPR.frigateWreck, x, y, opts);
      opts.alpha = 1;
      if (fade > 0.3) {
        smoke(r, t, x - 8, y - 4, i * 5 + 2, 3);
        smoke(r, t, x + 10, y, i * 5 + 4, 3);
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Roster extras (registerEnemyDraw, z 40).

export function drawMissile(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  spr(
    r,
    SPR.missile,
    x,
    y,
    Math.floor(w.time * 14 + e.id) % 2,
    e.flashT > 0,
    velocityRot(e.vx, e.vy),
  );
}

export function drawMine(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  spr(r, SPR.mine, x, y, mineFrame(e, MINE.fuse, MINE.warn, w.time), e.flashT > 0);
}
