import { JX_SCRIPTS } from '../../../content/levels/junction';
import { PORTAL } from '../../../content/obstacles';
import { spawnEnemy } from '../../../sim/spawn';
import type { Enemy } from '../../../sim/types';
import type { System, World } from '../../../sim/world';
import type { LevelScriptArgs } from '../../director';
import { portalOptIn, spawnPortalPair, spawnRock, swapPortals } from '../../obstacles';
import { attachPylon } from './behaviors';
import { collapseTagged, jx, peekJx, tagPair, taggedPair, type Stream } from './state';

// Level scripts (timeline `script` events) and the sector's level system: the
// junction rush's swaps and the feedback loop's streams and gnat opt-ins.

const PAIR_O = { color: 'cyan' };
const SPAWN_O = { ax: 0, ay: 0 };
const ROCK_O = { size: JX_SCRIPTS.stream.rockSize, x: 0, y: 0, vx: 0, vy: 0 };
const GNAT_O = { vx: 0, vy: 0 };
const RUSH_TAGS = ['r0', 'r1', 'r2'] as const;
/** Things poured from a top ring appear where a body leaving it downward would. */
const EXIT_D = PORTAL.r + PORTAL.exitPad;

function num(a: LevelScriptArgs, k: string, d: number): number {
  const v = a[k];
  return typeof v === 'number' ? v : d;
}

function str(a: LevelScriptArgs, k: string, d: string): string {
  const v = a[k];
  return typeof v === 'string' ? v : d;
}

/** `junction.pair { tag, ax, ay, bx, by, color }`: a fixed pair, tagged for `junction.collapse`. */
export function pairScript(w: World, a: LevelScriptArgs): void {
  PAIR_O.color = str(a, 'color', 'cyan');
  const p = spawnPortalPair(
    w,
    num(a, 'ax', 60),
    num(a, 'ay', 100),
    num(a, 'bx', 180),
    num(a, 'by', 100),
    PAIR_O,
  );
  if (p !== null) tagPair(w, str(a, 'tag', ''), p);
}

/** `junction.collapse { tag }` (`*`: every tagged pair). */
export function collapseScript(w: World, a: LevelScriptArgs): void {
  collapseTagged(w, str(a, 'tag', '*'));
}

/** `junction.aegis { x, lowDx }`: an Aegis whose entry ring sits lowDx px to the side. */
export function aegisScript(w: World, a: LevelScriptArgs): Enemy | null {
  jx(w);
  SPAWN_O.ax = num(a, 'lowDx', 0);
  SPAWN_O.ay = 0;
  return spawnEnemy(w, 'wj_aegis', num(a, 'x', 120), -12, SPAWN_O);
}

/** `junction.pylon { tag, end, x, holdY, dir }`: a pylon carrying `end` of the tagged pair. */
export function pylonScript(w: World, a: LevelScriptArgs): Enemy | null {
  SPAWN_O.ax = num(a, 'dir', 1);
  SPAWN_O.ay = num(a, 'holdY', 120);
  const e = spawnEnemy(w, 'wj_pylon', num(a, 'x', 120), -14, SPAWN_O);
  const p = taggedPair(w, str(a, 'tag', ''));
  if (e !== null && p !== null) attachPylon(w, e, p, str(a, 'end', 'b') === 'a' ? 'a' : 'b');
  return e;
}

/** `junction.rush`: the tagged pairs r0..r2 swap every `rushSwapEvery` s until `junction.rushEnd`. */
export function rushScript(w: World): void {
  const r = jx(w).rush;
  r.on = true;
  r.t = JX_SCRIPTS.rushSwapEvery;
  r.k = 0;
}

export function rushEndScript(w: World): void {
  const s = peekJx(w);
  if (s !== undefined) s.rush.on = false;
}

/** `junction.stream { tag, kind, n, gap }`: rocks or gnats poured out of the tagged pair's top ring. */
export function streamScript(w: World, a: LevelScriptArgs): void {
  const s = jx(w);
  for (const st of s.streams) {
    if (st.active) continue;
    st.active = true;
    st.tag = str(a, 'tag', '');
    st.kind = str(a, 'kind', 'rock') === 'gnat' ? 'gnat' : 'rock';
    st.left = num(a, 'n', 4);
    st.gap = num(a, 'gap', 1);
    st.t = 0;
    return;
  }
}

function tickRush(w: World, dt: number): void {
  const r = jx(w).rush;
  if (!r.on) return;
  r.t -= dt;
  if (r.t > 0) return;
  r.t += JX_SCRIPTS.rushSwapEvery;
  const i = r.k % 3;
  r.k++;
  const p = taggedPair(w, RUSH_TAGS[i] as string);
  const q = taggedPair(w, RUSH_TAGS[(i + 1) % 3] as string);
  if (p !== null && q !== null) swapPortals(w, p, q);
}

function tickStream(w: World, st: Stream, dt: number): void {
  const p = taggedPair(w, st.tag);
  if (p === null || st.left <= 0) {
    st.active = false;
    return;
  }
  st.t -= dt;
  if (st.t > 0) return;
  st.t += st.gap;
  st.left--;
  // The top ring is end a; things pour out under it.
  const x = p.a.x;
  const y = p.a.y + EXIT_D;
  if (st.kind === 'rock') {
    ROCK_O.x = x;
    ROCK_O.y = y;
    ROCK_O.vy = JX_SCRIPTS.stream.rockSpeed;
    spawnRock(w, ROCK_O);
  } else {
    GNAT_O.vy = 70;
    const e = spawnEnemy(w, 'gnat', x, y, GNAT_O);
    if (e !== null) portalOptIn(w, e.id);
  }
}

/** While a loop pair is up, gnats falling in its column use the portals too. */
function optInLoopGnats(w: World): void {
  for (let k = 0; k < 2; k++) {
    const p = taggedPair(w, k === 0 ? 'loop0' : 'loop1');
    if (p === null) continue;
    const items = w.enemies.items;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = items[i] as Enemy;
      if (!e.active || e.defId !== 'gnat' || e.vy <= 0) continue;
      if (Math.abs(e.x - p.b.x) > JX_SCRIPTS.loopOptInDx || e.y > p.b.y) continue;
      portalOptIn(w, e.id);
    }
  }
}

/** The junction's level system (timeline, boss and outro; not under `?sandbox`). */
export const junctionSystem: System = {
  name: 'junction.scripts',
  update(w, dt) {
    const s = peekJx(w);
    if (s === undefined) return;
    tickRush(w, dt);
    for (const st of s.streams) if (st.active) tickStream(w, st, dt);
    optInLoopGnats(w);
  },
};
