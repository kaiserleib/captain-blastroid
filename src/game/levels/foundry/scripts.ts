import {
  BEAT,
  CONTAINMENT,
  CONVEYOR,
  ESCAPE_CHUNKS,
  ESCAPE_ENTRY,
  ESCAPE_RUN,
  FURNACE,
  RIVETER_P,
  WELDING,
} from '../../../content/levels/foundry';
import { PULSAR_VARIANTS } from '../../../content/obstacles';
import { damageEnemy } from '../../../sim/damage';
import { pinAnomaly } from '../../../sim/scroll';
import { spawnEnemy, type EnemyOverrides } from '../../../sim/spawn';
import type { Anomaly, Enemy, Pickup } from '../../../sim/types';
import type { DrawLayer, System, World } from '../../../sim/world';
import type { LevelScriptArgs } from '../../director';
import { directorTime, escapeTimeLeft } from '../../director';
import {
  bubbles,
  collapseAnomaly,
  collapsePortalPair,
  isCollapsing,
  portalOptIn,
  portalPairs,
  removeBubble,
  removeShadeSlab,
  setPulsarPattern,
  shadeSlabs,
  spawnBlackHole,
  spawnPortalPair,
  spawnPulsar,
  spawnRock,
  spawnShadeSlab,
  stopFlares,
  type PortalPair,
  type ShadeSlab,
} from '../../obstacles';
import { clearTerrain, nearestOpenX, queueChunk, terrainQueued } from '../../terrain';
import { FD_SPRITES, MOLTEN5 } from './foundry.sprites';

// Level scripts and the sector system: riveter conveyor lines, containment
// (a captive hole in a slab ring), beat-locked welding pulsars, the furnace's
// portal conveyor (which carries the pod), and the escape run's corridors
// and debris. All per-world state is preallocated on first use.

const TAU = Math.PI * 2;

interface Line {
  active: boolean;
  y: number;
  dir: number;
  left: number;
  t: number;
  portal: boolean;
}

interface EscapeRun {
  armed: boolean;
  cleared: boolean;
  t: number;
  debrisT: number;
  /** Seeded order of ESCAPE_CHUNKS, cycled. */
  order: number[];
  next: number;
}

export interface FoundryState {
  lines: Line[];
  hole: Anomaly | null;
  holeId: number;
  holeT: number;
  settled: boolean;
  slabs: (ShadeSlab | null)[];
  contained: boolean;
  /** Welding pulsars waiting for the next beat-grid line (x px). */
  pending: number[];
  lastGrid: number;
  pairs: (PortalPair | null)[];
  pairIds: number[];
  pod: Pickup | null;
  podId: number;
  podCarried: boolean;
  podClaimed: boolean;
  escape: EscapeRun;
  /** Log of beats that happened (sector tests read it). */
  beats: string[];
  /** scrollY when the yard ended (gantries stop entering), or -1. */
  yardEndY: number;
}

const states = new WeakMap<World, FoundryState>();

export function foundryState(w: World): FoundryState {
  let s = states.get(w);
  if (s === undefined) {
    const lines: Line[] = [];
    for (let i = 0; i < CONVEYOR.maxLines; i++)
      lines.push({ active: false, y: 0, dir: 1, left: 0, t: 0, portal: false });
    s = {
      lines,
      hole: null,
      holeId: -1,
      holeT: 0,
      settled: false,
      slabs: CONTAINMENT.slabs.map(() => null),
      contained: false,
      pending: [],
      lastGrid: -1,
      pairs: [null, null],
      pairIds: [-1, -1],
      pod: null,
      podId: -1,
      podCarried: false,
      podClaimed: false,
      escape: { armed: false, cleared: false, t: 0, debrisT: 0, order: [], next: 0 },
      beats: [],
      yardEndY: -1,
    };
    states.set(w, s);
  }
  return s;
}

function note(w: World, s: FoundryState, what: string): void {
  if (s.beats.length < 64) s.beats.push(`${directorTime(w).toFixed(1)} ${what}`);
}

function num(args: LevelScriptArgs | undefined, k: string, d: number): number {
  const v = args?.[k];
  return typeof v === 'number' ? v : d;
}

// ---------------------------------------------------------------------------
// Conveyor lines.

function addLine(w: World, y: number, dir: number, n: number, portal: boolean): void {
  const s = foundryState(w);
  for (const l of s.lines) {
    if (l.active) continue;
    l.active = true;
    l.y = y;
    l.dir = dir < 0 ? -1 : 1;
    l.left = Math.max(1, Math.floor(n));
    l.t = 0;
    l.portal = portal;
    return;
  }
}

/** `foundry.conveyor` { y, dir, n }: a line of riveters crossing at row y. */
export function conveyorScript(w: World, args?: LevelScriptArgs): void {
  addLine(w, num(args, 'y', 100), num(args, 'dir', 1), num(args, 'n', 10), false);
  note(w, foundryState(w), 'conveyor');
}

/** `foundry.portalLine` { n }: a line onto the furnace's portal conveyor. */
export function portalLineScript(w: World, args?: LevelScriptArgs): void {
  addLine(w, FURNACE.rows[0] as number, 1, num(args, 'n', 8), true);
  note(w, foundryState(w), 'portalLine');
}

const lineO: EnemyOverrides = {};
const LINE_GAP = CONVEYOR.spacing / RIVETER_P.speed;

function tickLines(w: World, s: FoundryState, dt: number): void {
  for (const l of s.lines) {
    if (!l.active) continue;
    l.t -= dt;
    if (l.t > 0) continue;
    l.t += LINE_GAP;
    lineO.ax = l.dir;
    const x = l.dir > 0 ? -CONVEYOR.entryX : w.width + CONVEYOR.entryX;
    const e = spawnEnemy(w, 'fd_riveter', x, l.y, lineO);
    if (e !== null && l.portal) portalOptIn(w, e.id);
    if (--l.left <= 0) l.active = false;
  }
}

// ---------------------------------------------------------------------------
// Containment.

const HOLE_P = { variant: 'massive', vx: 0, vy: 0 };

function liveHole(s: FoundryState): Anomaly | null {
  const a = s.hole;
  return a !== null && a.active && a.id === s.holeId ? a : null;
}

/** `foundry.containment`: the captive massive hole falls into place inside its slab ring. */
export function containmentScript(w: World): void {
  const s = foundryState(w);
  if (s.contained) return;
  HOLE_P.vy = w.scrollSpeed;
  const a = spawnBlackHole(w, CONTAINMENT.x, -12, HOLE_P);
  if (a === null) return;
  s.hole = a;
  s.holeId = a.id;
  s.holeT = 0;
  s.settled = false;
  s.contained = true;
  for (let i = 0; i < CONTAINMENT.slabs.length; i++) {
    const [ox, oy] = CONTAINMENT.slabs[i] as readonly [number, number];
    s.slabs[i] = spawnShadeSlab(w, a.x + ox, a.y + oy, { vx: 0, vy: a.vy });
  }
  note(w, s, 'containment');
}

/** `foundry.containmentEnd`: the hole collapses and the slabs drop away. */
export function containmentEndScript(w: World): void {
  const s = foundryState(w);
  const a = liveHole(s);
  if (a !== null && !isCollapsing(a)) collapseAnomaly(w, a, CONTAINMENT.collapse);
  for (let i = 0; i < s.slabs.length; i++) {
    const sl = s.slabs[i];
    if (sl !== null && sl !== undefined && sl.active) {
      sl.vx = 0;
      sl.vy = CONTAINMENT.dropVy;
    }
    s.slabs[i] = null;
  }
  s.contained = false;
  note(w, s, 'containmentEnd');
}

function tickContainment(w: World, s: FoundryState, dt: number): void {
  if (!s.contained) return;
  const a = liveHole(s);
  if (a === null || isCollapsing(a)) {
    containmentEndScript(w);
    return;
  }
  s.holeT += dt;
  if (!s.settled && a.y >= CONTAINMENT.settleY) {
    s.settled = true;
    s.holeT = 0;
    a.vy = CONTAINMENT.settleVy;
    pinAnomaly(a);
  }
  if (s.settled) {
    const om = TAU / CONTAINMENT.swayPeriod;
    a.vx = Math.sin(s.holeT * om) * CONTAINMENT.sway * om;
  }
  const k = CONTAINMENT.slabK;
  for (let i = 0; i < s.slabs.length; i++) {
    const sl = s.slabs[i];
    if (sl === null || sl === undefined || !sl.active) continue;
    const [ox, oy] = CONTAINMENT.slabs[i] as readonly [number, number];
    // Obstacles move after the director: aim at where the hole will be next tick.
    const tx = a.x + a.vx * dt + ox;
    const ty = a.y + a.vy * dt + oy;
    sl.vx = a.vx + (tx - sl.x) * k;
    sl.vy = a.vy + (ty - sl.y) * k;
  }
}

/** `foundry.orbiters` { n, dir }: Act I Orbiters swoop in around the captive hole. */
export function orbitersScript(w: World, args?: LevelScriptArgs): void {
  const s = foundryState(w);
  const n = num(args, 'n', 2);
  const dir = num(args, 'dir', 1);
  const a = liveHole(s);
  const cx = a !== null ? a.x : w.rng.range(80, 160);
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    lineO.ax = dir;
    spawnEnemy(
      w,
      'hz_orbiter',
      cx + side * (CONTAINMENT.orbiterDx - (i >> 1) * 24),
      -12 - i * 8,
      lineO,
    );
  }
  lineO.ax = 0;
}

// ---------------------------------------------------------------------------
// Welding line: turning pulsars spawn on a 7-beat grid line, so every pulse
// lands on `foundry`'s beat.

export const PULSE_PERIOD = WELDING.beats * BEAT;
const PULSAR_P = { variant: WELDING.variant, phase: 0 };
const TURNING = PULSAR_VARIANTS.turning;
const PATTERN = {
  period: PULSE_PERIOD,
  gaps: TURNING.gaps,
  gapDeg: TURNING.gapDeg,
  gapSpin: TURNING.gapSpin,
};

/** `foundry.pulsar` { x }: queues a pulsar for the next grid line. */
export function pulsarScript(w: World, args?: LevelScriptArgs): void {
  const s = foundryState(w);
  if (s.pending.length < 6) s.pending.push(num(args, 'x', 120));
}

function tickPulsars(w: World, s: FoundryState): void {
  const t = directorTime(w);
  const grid = Math.floor(t / PULSE_PERIOD);
  const crossed = grid !== s.lastGrid;
  s.lastGrid = grid;
  if (!crossed || s.pending.length === 0) return;
  // The pulse clock starts at the grid line itself, not at this tick.
  PULSAR_P.phase = t - grid * PULSE_PERIOD;
  for (const x of s.pending) {
    const a = spawnPulsar(w, x, -6, PULSAR_P);
    if (a === null) continue;
    setPulsarPattern(a, PATTERN);
    note(w, s, 'pulsar');
  }
  s.pending.length = 0;
}

// ---------------------------------------------------------------------------
// The furnace: the portal conveyor, which carries the pod.

/** `foundry.portals`: two fixed pairs feed the line from row to row down the screen. */
export function portalsScript(w: World): void {
  const s = foundryState(w);
  const r = FURNACE.rows;
  for (let i = 0; i < 2; i++) {
    const p = spawnPortalPair(w, FURNACE.ax, r[i] as number, FURNACE.bx, r[i + 1] as number, {
      color: FURNACE.colors[i] as 'orange' | 'cyan',
    });
    s.pairs[i] = p;
    s.pairIds[i] = p === null ? -1 : p.id;
  }
  note(w, s, 'portals');
}

/** `foundry.furnaceEnd`: the conveyor shuts down. */
export function furnaceEndScript(w: World): void {
  const s = foundryState(w);
  for (let i = 0; i < s.pairs.length; i++) {
    const p = s.pairs[i];
    if (p !== null && p !== undefined && p.active && p.id === s.pairIds[i])
      collapsePortalPair(w, p);
    s.pairs[i] = null;
  }
  stopFlares(w);
  note(w, s, 'furnaceEnd');
}

function tickPod(w: World, s: FoundryState): void {
  if (!s.podClaimed && s.pairs[0] !== null) {
    const items = w.pickups.items;
    for (let i = 0; i < w.pickups.count; i++) {
      const k = items[i] as Pickup;
      if (!k.active || k.kind !== 'escapePod' || k.y > 0) continue;
      // Lift the director's pod onto the line, entering from the left edge.
      s.podClaimed = true;
      s.pod = k;
      s.podId = k.id;
      s.podCarried = true;
      k.x = k.prevX = 4;
      k.y = k.prevY = FURNACE.rows[0] as number;
      k.vy = 0;
      note(w, s, 'podOnLine');
      break;
    }
  }
  if (!s.podCarried) return;
  const k = s.pod;
  if (k === null || !k.active || k.id !== s.podId || k.magnetized) {
    s.podCarried = false;
    return;
  }
  const last = FURNACE.rows[FURNACE.rows.length - 1] as number;
  if (k.y >= last - 8 && (k.x >= FURNACE.podReleaseX || k.x > w.width - 30)) {
    s.podCarried = false;
    k.vy = FURNACE.podVy;
    note(w, s, 'podReleased');
    return;
  }
  k.vx = RIVETER_P.speed;
  k.vy = 0;
}

// ---------------------------------------------------------------------------
// Escape: corridors (escape-tagged chunks) and debris rocks, no enemies.

/** Clears everything a level beat or the boss may have left: enemies, portals, bubbles, slabs, flares. */
export function clearForEscape(w: World): void {
  const items = w.enemies.items;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = items[i] as Enemy;
    if (e.active && !e.isBoss) damageEnemy(w, e, e.hp, 'hazard');
  }
  const pairs = portalPairs(w);
  for (let i = 0; i < pairs.length; i++)
    if ((pairs[i] as PortalPair).active) collapsePortalPair(w, pairs[i] as PortalPair);
  const bs = bubbles(w);
  for (let i = 0; i < bs.length; i++) if (bs[i]!.active) removeBubble(w, bs[i]!);
  const sl = shadeSlabs(w);
  for (let i = 0; i < sl.length; i++) if (sl[i]!.active) removeShadeSlab(w, sl[i]!);
  stopFlares(w);
}

/** `foundry.escape` (and the escape phase itself): arms the corridor run. */
export function escapeScript(w: World): void {
  const s = foundryState(w);
  const e = s.escape;
  if (e.armed) return;
  e.armed = true;
  e.cleared = false;
  e.t = 0;
  e.debrisT = ESCAPE_RUN.debrisFirst;
  e.order.length = 0;
  for (let i = 0; i < ESCAPE_CHUNKS.length; i++) e.order.push(i);
  for (let i = e.order.length - 1; i > 0; i--) {
    const j = w.rng.int(0, i);
    const t = e.order[i] as number;
    e.order[i] = e.order[j] as number;
    e.order[j] = t;
  }
  e.next = 0;
  clearForEscape(w);
  queueChunk(w, ESCAPE_ENTRY, THEME);
  note(w, s, 'escape');
}

const THEME = { theme: 'foundry' };
const rockInit = { size: 'small' as 'small' | 'medium', x: 0, y: 0, vx: 0, vy: 0 };

function tickEscape(w: World, s: FoundryState, dt: number): void {
  const left = escapeTimeLeft(w);
  const e = s.escape;
  if (left < 0) {
    if (e.armed && !e.cleared) {
      e.cleared = true;
      clearTerrain(w);
    }
    return;
  }
  if (!e.armed) escapeScript(w);
  e.t += dt;
  if (!e.cleared) {
    if (left <= ESCAPE_RUN.clearAt) {
      e.cleared = true;
      clearTerrain(w);
      note(w, s, 'escapeClear');
    } else if (terrainQueued(w) < ESCAPE_RUN.queueRows) {
      const id = ESCAPE_CHUNKS[e.order[e.next % e.order.length] as number] as string;
      e.next++;
      queueChunk(w, id, THEME);
    }
  }
  // Debris: no rocks in the last seconds, so the white-out comes on a clear screen.
  e.debrisT -= dt;
  if (e.debrisT > 0 || left < 2) return;
  e.debrisT += ESCAPE_RUN.debrisEvery;
  const rng = w.rng;
  const medium = rng.next() < ESCAPE_RUN.debrisMedium;
  const hw = medium ? 9 : 6;
  const x = nearestOpenX(w, rng.range(24, w.width - 24), -6, hw);
  if (Number.isNaN(x)) return;
  rockInit.size = medium ? 'medium' : 'small';
  rockInit.x = x;
  rockInit.y = -10;
  rockInit.vx = rng.range(-6, 6);
  rockInit.vy = w.scrollSpeed + rng.range(ESCAPE_RUN.debrisSpeed[0], ESCAPE_RUN.debrisSpeed[1]);
  spawnRock(w, rockInit);
}

// ---------------------------------------------------------------------------

/** The sector's level system (the director's slot, every phase). */
export const foundrySystem: System = {
  name: 'foundry.beats',
  update(w, dt) {
    const s = foundryState(w);
    tickLines(w, s, dt);
    tickContainment(w, s, dt);
    tickPulsars(w, s);
    tickPod(w, s);
    tickEscape(w, s, dt);
    // A run started past the yard (`?t=`) shows no gantries at all.
    if (s.yardEndY === -1 && directorTime(w) >= 40)
      s.yardEndY = w.tick <= 1 ? -GANTRY_GAP : w.scrollY;
  },
};

// ---------------------------------------------------------------------------
// Layers.

const GANTRY_GAP = 230;
const GANTRY_PARALLAX = 0.55;
const gantryOpts = { frame: 0, alpha: 0.85 };

/** The yard's gantry silhouettes, at the sides behind the action (z 4, under the terrain). */
export const gantryLayer: DrawLayer = {
  name: 'foundry.gantries',
  z: 4,
  draw(w, r) {
    const s = states.get(w);
    const sy = w.scrollY * GANTRY_PARALLAX;
    const end = s !== undefined && s.yardEndY !== -1 ? s.yardEndY * GANTRY_PARALLAX : Infinity;
    gantryOpts.frame = Math.floor(w.time * 2) & 1;
    const first = Math.floor((sy - 520) / GANTRY_GAP);
    for (let i = first; i <= first + 4; i++) {
      // Gantry i enters at the top when sy reaches i·GAP; none enter after the yard.
      const at = i * GANTRY_GAP;
      if (at < 0 || at > end) continue;
      const y = sy - at - 60;
      if (y < -70 || y > 470) continue;
      r.sprite(FD_SPRITES.gantry, (i & 1) === 0 ? 6 : w.width - 6, y, gantryOpts);
    }
  },
};

const BEAM_COLORS = [hex(MOLTEN5[1]), hex(MOLTEN5[2]), hex(MOLTEN5[3])] as const;

/** Containment beams between neighbouring slabs while the hole is held (z 11, over the hole). */
export const containmentLayer: DrawLayer = {
  name: 'foundry.containment',
  z: 11,
  draw(w, r) {
    const s = states.get(w);
    if (s === undefined || !s.contained) return;
    const n = s.slabs.length;
    const phase = Math.floor(w.time * 12);
    for (let i = 0; i < n; i++) {
      const a = s.slabs[i];
      const b = s.slabs[(i + 1) % n];
      if (a === null || b === null || a === undefined || b === undefined) continue;
      if (!a.active || !b.active) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const steps = Math.floor(len / 3);
      for (let k = 2; k < steps - 1; k++) {
        if ((k + phase) % 5 > 2) continue;
        const t = k / steps;
        r.rect(
          Math.round(a.x + dx * t),
          Math.round(a.y + dy * t),
          1,
          1,
          BEAM_COLORS[(k + phase) % 3] as string,
        );
      }
    }
  },
};

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}
