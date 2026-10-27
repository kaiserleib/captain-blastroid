import type { AimedPattern } from '../../../content/enemies';
import { AEGIS_P, BLINKER_P, PYLON_P } from '../../../content/levels/junction';
import type { Renderer } from '../../../gfx/renderer';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { burst, canFire, SHOT_SMALL } from '../../enemies';
import {
  partnerOf,
  portalOptIn,
  portalPairs,
  setPortalEnd,
  spawnPortalPair,
  type PortalEnd,
  type PortalPair,
} from '../../obstacles';
import {
  aegisEntry,
  Aim,
  aimExit,
  blinkerEntry,
  claimAegis,
  claimBlinker,
  jx,
  ownedBy,
  ownPair,
  pairLive,
  peekJx,
  type BlinkerEntry,
} from './state';

type P = Readonly<Record<string, number>>;

// ---------------------------------------------------------------------------
// Blinker: enter → pick a ring → dive in → (portals carry it) hold at the
// partner, flash 0.5 s, aimed 3-burst → dive again; after `maxDives`, or with
// no usable ring on screen, it swoops at the ship's column and leaves.

export const BlinkState = {
  Enter: 1,
  Dive: 2,
  Hold: 3,
  Swoop: 4,
} as const;

const AIMED: AimedPattern = { kind: 'aimed', n: 1, spreadDeg: 0, speed: 95 };
const EXIT_SLIDE = 30;

/** Whether `end` is a ring a Blinker at (x, y) may dive into now. */
export function usableEnd(w: World, end: PortalEnd, x: number, y: number, p: P): boolean {
  if (end.x < 10 || end.x > w.width - 10 || end.y < 6 || end.y > 300) return false;
  if (Math.hypot(end.x - x, end.y - y) < 22) return false;
  const o = partnerOf(end);
  // An exit just over the top edge is fine: the hold glides it back on screen.
  if (o.x < 12 || o.x > w.width - 12 || o.y < -8) return false;
  const pl = w.player;
  // It comes out past the ring and slides a little before it stops: keep that margin too.
  const maxY = pl.alive ? pl.y - (p.exitAbovePlayer ?? 60) - EXIT_SLIDE : 300;
  return o.y <= maxY;
}

/** The nearest usable ring end other than `skip` (the exit it just used), or null. */
export function pickEnd(
  w: World,
  x: number,
  y: number,
  p: P,
  skip: PortalEnd | null = null,
): PortalEnd | null {
  let best: PortalEnd | null = null;
  let bestD = Infinity;
  const pairs = portalPairs(w);
  for (let i = 0; i < pairs.length; i++) {
    const pr = pairs[i] as PortalPair;
    if (!pr.active) continue;
    for (let k = 0; k < 2; k++) {
      const end = k === 0 ? pr.a : pr.b;
      if (end === skip || !usableEnd(w, end, x, y, p)) continue;
      const d = Math.hypot(end.x - x, end.y - y);
      if (d < bestD) {
        bestD = d;
        best = end;
      }
    }
  }
  return best;
}

function setTarget(b: BlinkerEntry, end: PortalEnd | null): void {
  b.target = end;
  b.targetPairId = end === null ? -1 : end.pair.id;
  b.t = 0;
}

function toSwoop(e: Enemy, b: BlinkerEntry | null): void {
  e.state = BlinkState.Swoop;
  if (b !== null) b.t = 0;
  if (e.vy < 40) e.vy = 40;
}

export function blinkerBehavior(w: World, e: Enemy, p: P, dt: number): void {
  if (e.state === 0) {
    e.state = BlinkState.Enter;
    portalOptIn(w, e.id);
    claimBlinker(w, e);
  }
  const b = blinkerEntry(w, e.id);
  if (b === null) {
    swoop(w, e, p, dt);
    return;
  }
  const jumped = Math.hypot(e.x - b.lastX, e.y - b.lastY) > (p.jump ?? 12);
  b.lastX = e.x;
  b.lastY = e.y;
  b.t += dt;
  switch (e.state) {
    case BlinkState.Enter: {
      e.vx = 0;
      e.vy = e.y < (p.enterY ?? 56) ? (p.enterSpeed ?? 90) : 0;
      const end = pickEnd(w, e.x, e.y, p);
      if (end !== null) {
        setTarget(b, end);
        e.state = BlinkState.Dive;
      } else if (b.t >= (p.search ?? 0.9) && e.y >= (p.enterY ?? 56) - 1) toSwoop(e, b);
      break;
    }
    case BlinkState.Dive: {
      if (jumped) {
        // Through a ring: hold at the exit.
        b.exit = b.target === null ? null : partnerOf(b.target);
        e.state = BlinkState.Hold;
        b.t = 0;
        b.dives++;
        b.fired = false;
        e.vx = 0;
        e.vy = 0;
        break;
      }
      const end = b.target;
      if (end === null || !end.pair.active || b.t >= (p.diveTimeout ?? 3)) {
        const next = pickEnd(w, e.x, e.y, p);
        if (next === null) toSwoop(e, b);
        else setTarget(b, next);
        break;
      }
      const dx = end.x - e.x;
      const dy = end.y - e.y;
      const l = Math.max(1e-3, Math.hypot(dx, dy));
      const v = p.diveSpeed ?? 120;
      e.vx = (dx / l) * v;
      e.vy = (dy / l) * v;
      break;
    }
    case BlinkState.Hold: {
      // Glide back on screen if a ring threw it past an edge.
      e.vx = e.x < 14 ? 50 : e.x > w.width - 14 ? -50 : 0;
      e.vy = e.y < 16 ? 50 : 0;
      if (!b.fired && b.t >= (p.flash ?? 0.5)) {
        b.fired = true;
        if (canFire(w, e)) {
          AIMED.speed = p.shotSpeed ?? 95;
          burst(w, e, p.burstCount ?? 3, p.burstGap ?? 0.12, AIMED, SHOT_SMALL);
        }
      }
      if (b.t >= (p.hold ?? 1.2)) {
        const next = b.dives >= (p.maxDives ?? 3) ? null : pickEnd(w, e.x, e.y, p, b.exit);
        if (next === null) toSwoop(e, b);
        else {
          setTarget(b, next);
          e.state = BlinkState.Dive;
        }
      }
      break;
    }
    default:
      swoop(w, e, p, dt);
  }
}

/** Accelerates down and toward the ship's column, capped sideways; leaves off the bottom. */
function swoop(w: World, e: Enemy, p: P, dt: number): void {
  if (e.state !== BlinkState.Swoop) e.state = BlinkState.Swoop;
  const pl = w.player;
  const tx = pl.alive ? pl.x : e.x;
  const max = p.swoopMaxVx ?? 90;
  const pull = p.swoopPull ?? 140;
  e.vx += Math.sign(tx - e.x) * pull * dt;
  if (e.vx > max) e.vx = max;
  else if (e.vx < -max) e.vx = -max;
  const sp = p.swoopSpeed ?? 110;
  if (e.vy < sp) e.vy = Math.min(sp, e.vy + pull * dt);
}

/** 0..1 while the Blinker flashes before its burst (draw), else 0. */
export function blinkerFlash(w: World, e: Enemy): number {
  if (e.state !== BlinkState.Hold) return 0;
  const b = blinkerEntry(w, e.id);
  if (b === null || b.fired) return 0;
  return Math.min(1, b.t / BLINKER_P.flash);
}

// ---------------------------------------------------------------------------
// Gate Pylon: enter to its hold height, drift sideways at 18 px/s for `life`
// s, then leave off the nearer side. It carries one ring end beside it (set by
// `attachPylon`); its death collapses the pair (the junction pass).

export const PylonState = { Enter: 1, Drift: 2, Leave: 3 } as const;

export function pylonBehavior(w: World, e: Enemy, p: P, _dt: number): void {
  if (e.state === 0) {
    // Overrides: ax = drift direction, ay = hold height (0: defaults).
    if (e.ax === 0) e.ax = e.x < w.width / 2 ? 1 : -1;
    if (e.ay === 0) e.ay = 120;
    e.state = PylonState.Enter;
  }
  const drift = p.drift ?? 18;
  switch (e.state) {
    case PylonState.Enter:
      e.vx = 0;
      e.vy = p.enterSpeed ?? 40;
      if (e.y >= e.ay) {
        e.state = PylonState.Drift;
        e.fireT = e.t;
      }
      break;
    case PylonState.Drift: {
      e.vy = 0;
      const lo = p.minX ?? 26;
      const hi = p.maxX ?? 214;
      if (e.x <= lo) e.ax = 1;
      else if (e.x >= hi) e.ax = -1;
      e.vx = e.ax * drift;
      if (e.t - e.fireT >= (p.life ?? 16)) e.state = PylonState.Leave;
      break;
    }
    default:
      e.vy = 0;
      e.vx = (e.x < w.width / 2 ? -1 : 1) * (p.leaveSpeed ?? 30);
  }
  const o = ownedBy(w, e);
  if (o !== null && o.end !== '' && pairLive(o.pair, o.pairId)) {
    setPortalEnd(w, o.pair, o.end, e.x + o.dx, e.y);
  }
}

/** Hands `end` of `pair` to a pylon: it carries the ring beside it until it dies. */
export function attachPylon(w: World, e: Enemy, pair: PortalPair, end: 'a' | 'b'): boolean {
  const dx = e.x < w.width / 2 ? PYLON_P.ringDx : -PYLON_P.ringDx;
  const o = ownPair(w, e, pair, end, dx);
  if (o === null) return false;
  setPortalEnd(w, pair, end, e.x + dx, e.y);
  return true;
}

// ---------------------------------------------------------------------------
// Aegis: enter to the hold height, sway, climb away after `hold` s. It owns a
// pair: the exit `exitDy` above it (an aimed exit pointing at its back) and
// the entry at (x + lowDx, lowY). Its front shield lives in the junction pass.

export const AegisState = { Enter: 1, Hold: 2, Leave: 3 } as const;
const PAIR_COLOR = { color: 'lime' };

export function aegisBehavior(w: World, e: Enemy, p: P, _dt: number): void {
  if (e.state === 0) {
    // Override ax = the entry ring's x offset (scripts set it).
    const a = claimAegis(w, e, e.ax);
    e.state = AegisState.Enter;
    if ((p.pair ?? 1) > 0 && a !== null) {
      const lowX = e.x + a.lowDx;
      const pair = spawnPortalPair(
        w,
        lowX,
        p.lowY ?? AEGIS_P.lowY,
        e.x,
        e.y + (p.exitDy ?? AEGIS_P.exitDy),
        PAIR_COLOR,
      );
      if (pair !== null) {
        ownPair(w, e, pair, '', 0);
        aimExit(w, pair.b, pair.id, pair.id, Aim.Point, e.x, e.y);
      }
    }
  }
  const a = aegisEntry(w, e);
  const holdY = p.holdY ?? AEGIS_P.holdY;
  switch (e.state) {
    case AegisState.Enter:
      e.vx = 0;
      e.vy = p.enterSpeed ?? 60;
      if (e.y >= holdY) {
        e.state = AegisState.Hold;
        e.ay = e.t;
      }
      break;
    case AegisState.Hold: {
      const ht = e.t - e.ay;
      const ax = a === null ? e.x : a.anchorX;
      const amp = p.sway ?? 10;
      const hz = p.swayHz ?? 0.18;
      const tx = ax + Math.sin(ht * hz * Math.PI * 2) * amp;
      e.vx = (tx - e.x) * 4;
      e.vy = (holdY - e.y) * 4;
      if (ht >= (p.hold ?? 14)) e.state = AegisState.Leave;
      break;
    }
    default:
      e.vx = 0;
      e.vy = -(p.leaveSpeed ?? 45);
  }
  const o = ownedBy(w, e);
  if (o !== null && pairLive(o.pair, o.pairId) && a !== null) {
    const pr = o.pair;
    setPortalEnd(w, pr, 'a', a.anchorX + a.lowDx, p.lowY ?? AEGIS_P.lowY);
    const ex = e.x;
    const ey = e.y + (p.exitDy ?? AEGIS_P.exitDy);
    setPortalEnd(w, pr, 'b', ex, ey);
    aimExit(w, pr.b, pr.id, pr.id, Aim.Point, e.x, e.y);
  }
}

/** Seconds since this Aegis's shield last absorbed a shot (draw), or a large number. */
export function aegisHitAgo(w: World, e: Enemy): number {
  return aegisEntry(w, e)?.hitAgo ?? 9;
}

// ---------------------------------------------------------------------------
// Draw hooks (z 40, after the sprite)

const WHITE = '#f8f8f8';
const CYAN = '#58d0f8';
const LIME = '#a8f040';

export function drawBlinker(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const k = blinkerFlash(w, e);
  if (k <= 0) return;
  // The 0.5 s exit flash: a ring closing on the Blinker, strobing.
  const rad = Math.round(e.r + 2 + (1 - k) * 8);
  r.circle(x, y, rad, Math.floor(w.time * 20) % 2 === 0 ? WHITE : CYAN, false);
}

export function drawAegis(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const ago = aegisHitAgo(w, e);
  if (ago > 0.12) return;
  // The shield plate lights up where it took the shot.
  const yy = Math.round(y + e.r - 1);
  r.rect(Math.round(x) - 8, yy, 17, 1, Math.floor(ago * 50) % 2 === 0 ? WHITE : LIME);
}

/** Shield sparks for every Aegis (drawn by the junction layer). */
export function drawShieldSparks(w: World, r: Renderer): void {
  const s = peekJx(w);
  if (s === undefined) return;
  const sp = s.sparks;
  for (let i = 0; i < sp.length; i += 3) {
    const age = sp[i + 2] as number;
    if (age >= 0.15) continue;
    const x = Math.round(sp[i] as number);
    const yy = Math.round(sp[i + 1] as number);
    const d = 1 + Math.floor(age * 20);
    r.rect(x - d, yy, 1, 1, WHITE);
    r.rect(x + d, yy, 1, 1, WHITE);
    r.rect(x, yy + d, 1, 1, LIME);
  }
}

/** Starts per-world state (sandbox and tests that spawn enemies without a script). */
export function touchJunction(w: World): void {
  jx(w);
}
