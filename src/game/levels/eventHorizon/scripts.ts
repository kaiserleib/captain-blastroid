import { HZ_SCRIPTS, ORBITER_P } from '../../../content/levels/eventHorizon';
import { isPinned } from '../../../sim/scroll';
import { spawnEnemy } from '../../../sim/spawn';
import type { Anomaly } from '../../../sim/types';
import type { System, World } from '../../../sim/world';
import type { LevelScriptArgs } from '../../director';
import { collapseAnomaly, isCollapsing, isFieldOnly, spawnBlackHole } from '../../obstacles';
import { nearestHole } from './behaviors';

// Level scripts and the level system (timeline beats a plain event can't express).

interface HzWorld {
  massive: Anomaly | null;
  massiveId: number;
  massiveT: number;
}

const worlds = new WeakMap<World, HzWorld>();

function stateOf(w: World): HzWorld {
  let s = worlds.get(w);
  if (s === undefined) {
    s = { massive: null, massiveId: -1, massiveT: 0 };
    worlds.set(w, s);
  }
  return s;
}

function num(args: LevelScriptArgs, k: string, d: number): number {
  const v = args[k];
  return typeof v === 'number' ? v : d;
}

const orbitO = { ax: 1 };

/**
 * `eventHorizon.orbiters { x, n, dir }`: n Orbiters around the hole nearest
 * (x, 60), evenly spaced from the top, just outside their orbit so they
 * spiral in. With no hole on screen they enter from the top at x.
 */
export function spawnOrbiters(w: World, args: LevelScriptArgs): number {
  const x = num(args, 'x', 120);
  const n = Math.max(1, Math.floor(num(args, 'n', 2)));
  orbitO.ax = num(args, 'dir', 1) < 0 ? -1 : 1;
  const h = nearestHole(w, x, 60);
  let made = 0;
  for (let i = 0; i < n; i++) {
    let sx = x + (i - (n - 1) / 2) * 20;
    let sy = -14;
    if (h !== null) {
      let a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const rad = ORBITER_P.radius + HZ_SCRIPTS.orbiterEntryExtra;
      // Never appear on top of the player: flip that slot to the far side of the hole.
      const pl = w.player;
      const px = h.x + Math.cos(a) * rad - pl.x;
      const py = h.y + Math.sin(a) * rad - pl.y;
      if (pl.alive && px * px + py * py < HZ_SCRIPTS.orbiterSpawnClear ** 2) a = -a;
      sx = h.x + Math.cos(a) * rad;
      sy = h.y + Math.sin(a) * rad;
    }
    if (spawnEnemy(w, 'hz_orbiter', sx, sy, orbitO) !== null) made++;
  }
  return made;
}

const holeP = { vx: 0, vy: 0, variant: '' };

/** `eventHorizon.massive { x }`: the centerpiece hole; the level system settles and sways it. */
export function spawnMassive(w: World, args: LevelScriptArgs): void {
  const m = HZ_SCRIPTS.massive;
  holeP.variant = m.variant;
  holeP.vy = w.scrollSpeed;
  const a = spawnBlackHole(w, num(args, 'x', 120), 0, holeP);
  if (a === null) return;
  a.y = a.prevY = -a.r;
  const s = stateOf(w);
  s.massive = a;
  s.massiveId = a.id;
  s.massiveT = 0;
}

/** `eventHorizon.collapse`: every unpinned hole with a core collapses (the field clears for the boss). */
export function collapseHoles(w: World, args: LevelScriptArgs): void {
  const dur = num(args, 'dur', HZ_SCRIPTS.collapse);
  const items = w.anomalies.items;
  for (let i = 0; i < w.anomalies.count; i++) {
    const a = items[i] as Anomaly;
    if (!a.active || a.kind !== 'blackhole' || isFieldOnly(a) || isPinned(a) || isCollapsing(a))
      continue;
    collapseAnomaly(w, a, dur);
  }
}

/** Eases the massive hole from scroll speed to a slow settle below `settleY`, swaying sideways. */
export const massiveSystem: System = {
  name: 'eventHorizon.massive',
  update(w, dt) {
    const s = worlds.get(w);
    if (s === undefined || s.massive === null) return;
    const a = s.massive;
    if (!a.active || a.id !== s.massiveId) {
      s.massive = null;
      return;
    }
    const m = HZ_SCRIPTS.massive;
    s.massiveT += dt;
    const k = Math.min(1, Math.max(0, (m.settleY - a.y) / 60));
    a.vy = m.settleVy + (w.scrollSpeed - m.settleVy) * k;
    a.vx = Math.sin((s.massiveT / m.swayPeriod) * Math.PI * 2) * m.sway;
  },
};
