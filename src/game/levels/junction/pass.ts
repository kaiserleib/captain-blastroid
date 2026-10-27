// The junction's collision-slot pass (registered with `registerCollisionPass`):
// it runs after every body moved and portals teleported, before the broad
// phase. It turns shots leaving aimed exits, lets Aegis shields eat shots from
// below, holds Janus's wall, and closes pairs whose owner is gone. A no-op for
// worlds without junction state.
import { AEGIS_BYPASS, JX_SCRIPTS } from '../../../content/levels/junction';
import { PORTAL } from '../../../content/obstacles';
import type { Bullet, Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import {
  addSpark,
  Aim,
  aimedValid,
  enemyLive,
  peekJx,
  sweepOwned,
  type AimedExit,
  type JunctionState,
} from './state';

const EXIT_D = PORTAL.r + PORTAL.exitPad;
const PING_GAP = 0.12;
const SFX_P = { id: 'armor_ping', x: 0 as number | undefined };

export function junctionPass(w: World, dt: number): void {
  const s = peekJx(w);
  if (s === undefined) return;
  sweepOwned(w, s);
  for (let i = 2; i < s.sparks.length; i += 3) s.sparks[i] = (s.sparks[i] as number) + dt;
  for (const a of s.aegis) a.hitAgo += dt;
  s.pingT -= dt;
  reaim(w, s);
  shields(w, s);
  wall(w, s);
}

/** A shot that left a portal this tick sits exactly r + pad from the exit with prev = pos. */
function justLeft(b: Bullet, a: AimedExit): boolean {
  if (b.x !== b.prevX || b.y !== b.prevY) return false;
  const e = a.end;
  if (e === null) return false;
  const d = Math.hypot(b.x - e.x, b.y - e.y);
  return Math.abs(d - EXIT_D) <= JX_SCRIPTS.aimSlack;
}

function reaim(w: World, s: JunctionState): void {
  let any = false;
  for (const a of s.aimed) if (a.mode !== Aim.Off && aimedValid(a)) any = true;
  if (!any) return;
  const items = w.playerShots.items;
  for (let i = 0; i < w.playerShots.count; i++) {
    const b = items[i] as Bullet;
    if (!b.active) continue;
    for (const a of s.aimed) {
      if (a.mode === Aim.Off || !aimedValid(a) || !justLeft(b, a)) continue;
      turn(b, a);
      s.reaimed++;
      break;
    }
  }
}

/** Points `b` out of its exit toward the target, keeping its speed. Exported for tests. */
export function turn(b: Bullet, a: AimedExit): void {
  const e = a.end;
  if (e === null) return;
  let dx = 0;
  let dy = 1;
  if (a.mode === Aim.Point) {
    dx = a.tx - e.x;
    dy = a.ty - e.y;
    const l = Math.hypot(dx, dy);
    if (l < 1e-3) {
      dx = 0;
      dy = 1;
    } else {
      dx /= l;
      dy /= l;
    }
  }
  const v = Math.hypot(b.vx, b.vy);
  b.vx = dx * v;
  b.vy = dy * v;
  b.x = b.prevX = e.x + dx * EXIT_D;
  b.y = b.prevY = e.y + dy * EXIT_D;
}

/** Whether an Aegis shield stops this shot: it arrives from below the centerline, heading up. */
export function shieldStops(e: Enemy, b: Bullet): boolean {
  if (b.vy >= 0 || b.y < e.y) return false;
  const id = b.weaponId;
  if (id !== null && AEGIS_BYPASS.weapons.includes(id)) return false;
  if (id === 'ricochet' && Math.abs(b.vx) >= Math.abs(b.vy) * AEGIS_BYPASS.ricochetSlope)
    return false;
  return true;
}

function shields(w: World, s: JunctionState): void {
  for (const a of s.aegis) {
    const e = a.enemy;
    if (!enemyLive(e, a.id)) continue;
    const items = w.playerShots.items;
    for (let i = 0; i < w.playerShots.count; i++) {
      const b = items[i] as Bullet;
      if (!b.active) continue;
      const rr = e.r + b.r + 1;
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      if (dx * dx + dy * dy >= rr * rr || !shieldStops(e, b)) continue;
      w.playerShots.release(b);
      s.shieldAbsorbed++;
      a.hitAgo = 0;
      addSpark(s, b.x, e.y + e.r * 0.6);
      ping(w, s, e.x);
    }
  }
}

function wall(w: World, s: JunctionState): void {
  const wl = s.wall;
  if (!wl.on) return;
  const p = w.player;
  // The wall's field holds the ship below it, flickering or not.
  const minY = wl.y + wl.shipPad;
  if (p.alive && p.y < minY) p.y = minY;
  if (wl.down) return;
  const items = w.playerShots.items;
  for (let i = 0; i < w.playerShots.count; i++) {
    const b = items[i] as Bullet;
    if (!b.active || b.y > wl.y || b.x < wl.x0 || b.x > wl.x1) continue;
    // Shots crossing up through it; and Flak fragments from a shell that burst behind
    // it (shells aren't portal bodies, so nothing legit bursts there).
    const crossing = b.vy < 0 && b.prevY >= wl.y;
    if (!crossing && b.weaponId !== 'flak') continue;
    w.playerShots.release(b);
    wl.absorbed++;
    if (wl.absorbed % 3 === 0) addSpark(s, b.x, wl.y);
  }
}

function ping(w: World, s: JunctionState, x: number): void {
  if (s.pingT > 0) return;
  s.pingT = PING_GAP;
  SFX_P.x = x;
  w.events.emit('sfx', SFX_P);
}
