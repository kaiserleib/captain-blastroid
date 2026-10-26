import type { Renderer, SpriteOpts } from '../../../gfx/renderer';
import { damageEnemy } from '../../../sim/damage';
import type { Asteroid, Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { aimed, canFire, emitEnemyShotSfx, muzzleY, ring, SHOT_SMALL } from '../../enemies';
import { drawTractorBeam, flingRock, isTowed, towRock } from '../../obstacles';
import { ION, ION_SPRITES, TUG_EMITTER, WHITE } from './ionShoals.sprites';

// Custom behaviors for the Ion Shoals roster. Each owns e.vx/e.vy (the enemy
// system integrates), e.state (0 = first tick) and e.ax/e.ay, and reads e.t
// (seconds alive before this tick). Per-enemy extras (the tug's rock) live in
// a side table keyed by pool slot and checked by id, so nothing allocates
// per tick once a slot has been used.

type P = Readonly<Record<string, number>>;

const MARGIN = 16;
const SFX_P = { id: '', x: 0 as number | undefined };

function sfx(w: World, id: string, x: number): void {
  SFX_P.id = id;
  SFX_P.x = x;
  w.events.emit('sfx', SFX_P);
}

function n(p: P, k: string): number {
  return p[k] as number;
}

// ---------------------------------------------------------------------------
// Tug

export const TugState = {
  Descend: 1,
  Hold: 2,
  Tow: 3,
  Leave: 4,
} as const;

interface TugSide {
  id: number;
  rock: Asteroid | null;
  rockId: number;
  /** Seconds in the current tow. */
  towT: number;
  /** Seconds until the next tow attempt. */
  cool: number;
  /** Seconds since the last fling (the dish flares). */
  flungT: number;
}

const tugs = new WeakMap<Enemy, TugSide>();

/** The tug's per-slot extras (reset when the slot holds a new enemy). */
export function tugSide(e: Enemy): TugSide {
  let s = tugs.get(e);
  if (s === undefined) {
    s = { id: -1, rock: null, rockId: -1, towT: 0, cool: 0, flungT: 9 };
    tugs.set(e, s);
  }
  if (s.id !== e.id) {
    s.id = e.id;
    s.rock = null;
    s.rockId = -1;
    s.towT = 0;
    s.cool = 0;
    s.flungT = 9;
  }
  return s;
}

/** The rock a tug is holding right now, or null. */
export function tugRock(e: Enemy): Asteroid | null {
  const s = tugs.get(e);
  if (s === undefined || s.id !== e.id || s.rock === null) return null;
  return s.rock.active && s.rock.id === s.rockId ? s.rock : null;
}

/** The nearest medium or large rock within `range` px that nobody holds, on screen and above the ship. */
export function findTowable(w: World, x: number, y: number, range: number): Asteroid | null {
  const items = w.asteroids.items;
  const py = w.player.y;
  let best: Asteroid | null = null;
  let bestD = range * range;
  for (let i = 0; i < w.asteroids.count; i++) {
    const a = items[i] as Asteroid;
    if (!a.active || a.size === 'small' || a.hp <= 0 || isTowed(a)) continue;
    if (a.y < 0 || a.y > py - 40) continue;
    const dx = a.x - x;
    const dy = a.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

function fling(w: World, e: Enemy, s: TugSide, rock: Asteroid, speed: number): void {
  const pl = w.player;
  // Aimed only from above the ship (the shot fairness rule); otherwise it drops it.
  if (pl.alive && rock.y <= pl.y - 24) flingRock(w, rock, speed, pl.x, pl.y);
  else flingRock(w, rock, speed, rock.x, rock.y + 100);
  s.rock = null;
  s.rockId = -1;
  s.flungT = 0;
  sfx(w, 'boss_throw', e.x);
}

function startTow(w: World, e: Enemy, s: TugSide, rock: Asteroid, p: P): void {
  s.rock = rock;
  s.rockId = rock.id;
  s.towT = 0;
  e.state = TugState.Tow;
  // Claim it this tick, so a second tug doesn't pick the same rock.
  towRock(w, rock, e.x, e.y + n(p, 'holdOy'), n(p, 'k'), e.vx, e.vy);
}

export function tugBehavior(w: World, e: Enemy, p: P, dt: number): void {
  const s = tugSide(e);
  s.flungT += dt;
  if (e.state === 0) {
    if (e.ay <= 0) e.ay = w.rng.range(n(p, 'holdMin'), n(p, 'holdMax'));
    s.cool = n(p, 'firstDelay');
    e.state = TugState.Descend;
  }
  if (e.state !== TugState.Leave && e.t >= n(p, 'leaveAfter')) {
    const held = tugRock(e);
    if (held !== null) fling(w, e, s, held, n(p, 'flingSpeed'));
    e.state = TugState.Leave;
  }

  switch (e.state) {
    case TugState.Descend: {
      e.avoidsAsteroids = true;
      e.vx = 0;
      e.vy = n(p, 'descend');
      if (e.y >= e.ay - 1) {
        e.state = TugState.Hold;
        return;
      }
      // It reaches for a rock on the way in, so the haul starts as it arrives.
      s.cool -= dt;
      if (s.cool > 0 || e.y < 12) return;
      const rock = findTowable(w, e.x, e.y, n(p, 'range'));
      if (rock !== null) startTow(w, e, s, rock, p);
      return;
    }
    case TugState.Leave:
      e.avoidsAsteroids = true;
      e.vx = 0;
      e.vy = n(p, 'exitVy');
      return;
  }

  // Hold and Tow: drift slowly toward the ship's x, spring back to the hold line.
  // Avoidance is off here: it would sidestep the tug's own catch.
  e.avoidsAsteroids = false;
  const pl = w.player;
  const cap = n(p, 'drift');
  let vx = pl.alive ? (pl.x - e.x) * n(p, 'driftK') : 0;
  vx = vx > cap ? cap : vx < -cap ? -cap : vx;
  if ((e.x <= MARGIN && vx < 0) || (e.x >= w.width - MARGIN && vx > 0)) vx = 0;
  e.vx = vx;
  const d = n(p, 'descend');
  const vy = (e.ay - e.y) * 3;
  e.vy = vy > d ? d : vy < -d ? -d : vy;

  if (e.state === TugState.Hold) {
    s.cool -= dt;
    if (s.cool > 0) return;
    const rock = findTowable(w, e.x, e.y, n(p, 'range'));
    if (rock !== null) {
      startTow(w, e, s, rock, p);
      return;
    }
    s.cool = n(p, 'interval');
    if (canFire(w, e) && aimed(w, e.x, muzzleY(e), 1, 0, n(p, 'shotSpeed'), SHOT_SMALL) > 0)
      emitEnemyShotSfx(w, e.x);
    return;
  }

  // Tow.
  const rock = tugRock(e);
  if (rock === null) {
    // Shot apart (or swallowed) mid-tow: try again a little later.
    s.rock = null;
    e.state = TugState.Hold;
    s.cool = n(p, 'interval') * 0.4;
    return;
  }
  towRock(w, rock, e.x, e.y + n(p, 'holdOy'), n(p, 'k'), e.vx, e.vy);
  s.towT += dt;
  if (s.towT >= n(p, 'towTime')) {
    fling(w, e, s, rock, n(p, 'flingSpeed'));
    e.state = TugState.Hold;
    s.cool = Math.max(0.5, n(p, 'interval') - n(p, 'towTime'));
  }
}

/** The tractor beam (and the dish flare after a throw), over the tug's sprite. */
export function drawTug(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const ex = x + TUG_EMITTER.x;
  const ey = y + TUG_EMITTER.y;
  const rock = tugRock(e);
  if (rock !== null) {
    drawTractorBeam(r, ex, ey, rock.x, rock.y, w.time);
    // The dish glows while it hauls.
    if (Math.floor(w.time * 12) % 2 === 0)
      r.rect(Math.round(ex) - 1, Math.round(ey) - 1, 2, 2, WHITE_HEX);
  } else if (tugSide(e).flungT < 0.15) {
    r.circle(ex, ey, 3, ION_HI_HEX, false);
  }
}

const WHITE_HEX = hex(WHITE);
const ION_HI_HEX = hex(ION[4]);

function hex(col: number): string {
  return `#${col.toString(16).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// Skiff

export const SkiffState = {
  Weave: 1,
  PeelLeft: 2,
  PeelRight: 3,
} as const;

/**
 * ax, ay = unit heading: straight down, or the spawn velocity's direction (a
 * side sweep spawns with vx/vy set). It weaves across that heading. A diving
 * skiff makes one pass: after its shot it peels off toward its nearer side
 * edge, the weave fading out, instead of ramming on through the ship's row.
 */
export function skiffBehavior(w: World, e: Enemy, p: P, dt: number): void {
  if (e.state === 0) {
    const len = Math.hypot(e.vx, e.vy);
    if (len > 1e-3) {
      e.ax = e.vx / len;
      e.ay = e.vy / len;
    } else {
      e.ax = 0;
      e.ay = 1;
    }
    e.state = SkiffState.Weave;
  }
  const peelAt = n(p, 'peelAt');
  if (e.state === SkiffState.Weave && e.t >= peelAt && e.ay > 0.8) {
    e.state = e.x < w.width / 2 ? SkiffState.PeelLeft : SkiffState.PeelRight;
  }
  let fade = 1;
  if (e.state !== SkiffState.Weave) {
    fade = Math.max(0, 1 - (e.t - peelAt) * 2);
    const dir = e.state === SkiffState.PeelLeft ? -1 : 1;
    // Turn the heading toward the side, up to peelMax off straight down.
    const a = Math.atan2(e.ax, e.ay);
    const max = n(p, 'peelMax');
    const na = Math.max(-max, Math.min(max, a + dir * n(p, 'peelTurn') * dt));
    e.ax = Math.sin(na);
    e.ay = Math.cos(na);
  }
  const om = n(p, 'hz') * Math.PI * 2;
  const lat = n(p, 'amp') * om * Math.cos(e.t * om) * fade;
  const sp = n(p, 'speed');
  e.vx = e.ax * sp - e.ay * lat;
  e.vy = e.ay * sp + e.ax * lat;
  const at = n(p, 'shootAt');
  if (e.t < at && e.t + dt >= at && canFire(w, e)) {
    if (aimed(w, e.x, muzzleY(e), 1, 0, n(p, 'shotSpeed'), SHOT_SMALL) > 0)
      emitEnemyShotSfx(w, e.x);
  }
}

// ---------------------------------------------------------------------------
// Ion Mine

export const MineState = {
  Drift: 1,
  Armed: 2,
} as const;

/** ax = seconds alive when it armed. */
export function mineBehavior(w: World, e: Enemy, p: P, _dt: number): void {
  if (e.state === 0) e.state = MineState.Drift;
  e.vx = 0;
  e.vy = w.scrollSpeed + n(p, 'vy');
  if (e.state === MineState.Drift) {
    const pl = w.player;
    const tr = n(p, 'trigger');
    const near = pl.alive && (pl.x - e.x) ** 2 + (pl.y - e.y) ** 2 < tr * tr;
    if (near || e.t >= n(p, 'fuse')) {
      e.state = MineState.Armed;
      e.ax = e.t;
    }
    return;
  }
  if (e.t - e.ax < n(p, 'arm')) return;
  // Burst: the ring goes out and the mine is spent (no drop, no score).
  if (e.y >= 0 && e.y <= w.height && w.player.alive) {
    const rot = 180 / n(p, 'ringN');
    if (ring(w, e.x, e.y, n(p, 'ringN'), n(p, 'ringSpeed'), rot, SHOT_SMALL) > 0)
      emitEnemyShotSfx(w, e.x);
  }
  damageEnemy(w, e, e.hp, 'hazard');
}

/** Seconds until an armed mine bursts, or -1. */
export function mineFuseLeft(e: Enemy, p: P): number {
  if (e.state !== MineState.Armed) return -1;
  return Math.max(0, n(p, 'arm') - (e.t - e.ax));
}

const mineOpts: SpriteOpts = { frame: 0, flash: false };
const RING_HEX = '#f8a800';

/** Armed: the lamp and coil go hot and a warning ring closes in on the mine. */
export function drawMine(w: World, r: Renderer, e: Enemy, x: number, y: number, p: P): void {
  const left = mineFuseLeft(e, p);
  if (left < 0) return;
  mineOpts.frame = Math.floor(w.time * 16);
  mineOpts.flash = e.flashT > 0;
  r.sprite(ION_SPRITES.mineHot, x, y, mineOpts);
  const k = left / n(p, 'arm');
  const rad = 9 + Math.round(k * 14);
  r.circle(x, y, rad, Math.floor(w.time * 20) % 2 === 0 ? RING_HEX : WHITE_HEX, false);
}
