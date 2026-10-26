import { flags } from '../../debug/flags';
import { getLevel, type LevelDef } from '../../content/levels';
import { getSave } from '../../meta';
import type { Pickup, WeaponInstance } from '../../sim/types';
import type { System, World } from '../../sim/world';
import { spawnAsteroidStream } from '../obstacles';
import { collectPickup, spawnDrop, spraySalvage } from '../pickups';
import { fireEvent, stopField } from './events';
import { logLine, type DirectorState } from './state';
import {
  buildSchedule,
  firstFireAt,
  pickSchematic,
  segmentRate,
  type ScheduledFire,
} from './timeline';

/** Boss-defeat outro, seconds after `bossDefeated`. */
export const OUTRO = {
  /** Rewards fly to the ship (they'd otherwise drift off before the results). */
  magnetAt: 1.0,
  levelCompleteAt: 2.5,
  /** levelComplete + the results delay. */
  runOverAt: 5.5,
} as const;

/** `?t=` debug start: a plausible mid-level loadout. */
export const DEBUG_LOADOUT: readonly { id: string; level: number }[] = [
  { id: 'blaster', level: 3 },
  { id: 'spread', level: 2 },
];

export interface DirectorOptions {
  /** Start this many level seconds in, skipping earlier events. */
  startT?: number;
  /** Grant DEBUG_LOADOUT (only meaningful with startT > 0). */
  debugLoadout?: boolean;
}

const states = new WeakMap<World, DirectorState>();
const VICTORY = Object.freeze({ victory: true });
const NO_PAYLOAD = Object.freeze({}) as Record<string, never>;

/** Starts (or restarts) the director for a world. GameScene calls it from `enter`. */
export function startDirector(
  w: World,
  level: LevelDef,
  opts: DirectorOptions = {},
): DirectorState {
  states.get(w)?.offs.forEach((off) => off());
  const startT = Math.max(0, opts.startT ?? 0);
  const schedule = buildSchedule(level.timeline);
  const st: DirectorState = {
    level,
    t: startT,
    startT,
    phase: 'level',
    schedule,
    cursor: firstFireAt(schedule, startT),
    streams: level.asteroidField.map(() => null),
    segmentDone: level.asteroidField.map((s) => s.to <= startT),
    fieldStopped: false,
    forced: new Map(),
    forcedGranted: new Set(),
    capsuleFixes: [],
    outroT: 0,
    outroStep: 0,
    bossX: w.width / 2,
    bossY: 80,
    fires: level.timeline.map(() => 0),
    log: [],
    offs: [],
  };
  states.set(w, st);
  // Console/bot access in dev: `__director.world`, `__director.state`.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as unknown as { __director: unknown }).__director = { world: w, state: st };
  }
  w.time = startT;
  if (startT > 0 && opts.debugLoadout) grantLoadout(w);

  st.offs.push(
    w.events.on('formationCleared', (p) => {
      const weaponId = st.forced.get(p.formationId);
      if (weaponId === undefined) return;
      st.forced.delete(p.formationId);
      if (st.forcedGranted.has(weaponId) && ownsWeapon(w, weaponId)) return;
      st.capsuleFixes.push({ x: p.x, y: p.y, weaponId });
    }),
    w.events.on('bossDefeated', (p) => onBossDefeated(w, st, p.x, p.y)),
  );
  return st;
}

export function getDirector(w: World): DirectorState | undefined {
  return states.get(w);
}

/** Level clock (frozen while the boss lives); 0 before the director starts. */
export function directorTime(w: World): number {
  return states.get(w)?.t ?? 0;
}

function ownsWeapon(w: World, id: string): boolean {
  const ws = w.player.weapons;
  for (let i = 0; i < ws.length; i++) if ((ws[i] as WeaponInstance).id === id) return true;
  return false;
}

function grantLoadout(w: World): void {
  const p = w.player;
  for (const g of DEBUG_LOADOUT) {
    const owned = p.weapons.find((wi) => wi.id === g.id);
    if (owned) owned.level = Math.max(owned.level, g.level);
    else if (p.weapons.length < Math.max(p.maxWeaponSlots, 1))
      p.weapons.push({ id: g.id, level: g.level, cooldown: 0, state: 0 });
  }
}

function onBossDefeated(w: World, st: DirectorState, x: number, y: number): void {
  if (st.phase === 'outro' || st.phase === 'done') return;
  st.phase = 'outro';
  st.outroT = 0;
  st.outroStep = 0;
  st.bossX = x;
  st.bossY = y;
  stopField(st);
  w.run.bossDefeated = true;
  // Nothing can kill the player after the win.
  const shots = w.enemyShots;
  for (let i = 0; i < shots.count; i++) shots.release(shots.items[i]!);
  const save = getSave();
  const schematic = pickSchematic(st.level.schematicOnClear, save, w.run.schematics);
  if (schematic !== null) spawnDrop(w, 'schematic', x, y, schematic);
  spraySalvage(w, x, y, st.level.bossSalvage);
  logLine(st, `${st.t.toFixed(1)} bossDefeated schematic=${schematic ?? 'none'}`);
}

function updateField(w: World, st: DirectorState): void {
  if (st.fieldStopped) return;
  const segs = st.level.asteroidField;
  for (let i = 0; i < segs.length; i++) {
    if (st.segmentDone[i]) continue;
    const seg = segs[i]!;
    let s = st.streams[i] ?? null;
    if (st.t >= seg.to) {
      s?.stop();
      st.streams[i] = null;
      st.segmentDone[i] = true;
      continue;
    }
    if (st.t < seg.from) continue;
    if (s === null) {
      s = spawnAsteroidStream(w, {
        rate: segmentRate(seg, st.t),
        sizeWeights: seg.sizes,
        ...(seg.speed && { speedRange: seg.speed }),
        ...(seg.angle && { angleRange: seg.angle }),
        ...(seg.xRange && { xRange: seg.xRange }),
        ...(seg.jitter !== undefined && { jitter: seg.jitter }),
      });
      st.streams[i] = s;
    }
    s.config.rate = segmentRate(seg, st.t);
  }
}

function fireDue(w: World, st: DirectorState): void {
  const sched = st.schedule;
  // A boss event flips the phase, which stops the loop (the timeline waits for the boss).
  while (st.phase === 'level' && st.cursor < sched.length) {
    const f = sched[st.cursor] as ScheduledFire;
    if (f.t > st.t) break;
    st.cursor++;
    st.fires[f.index]!++;
    fireEvent(w, st, st.level.timeline[f.index]!);
  }
}

function applyCapsuleFixes(w: World, st: DirectorState): void {
  const fixes = st.capsuleFixes;
  if (fixes.length === 0) return;
  const items = w.pickups.items;
  const n = w.pickups.count;
  for (const fix of fixes) {
    // T12 spawns the clear capsule exactly where the last member died.
    let found = false;
    for (let i = 0; i < n; i++) {
      const k = items[i] as Pickup;
      if (!k.active || k.kind !== 'weapon' || k.x !== fix.x || k.y !== fix.y) continue;
      k.payload = fix.weaponId;
      found = true;
      break;
    }
    // T12's capsule gap can skip a clear; a forced capsule still has to appear.
    if (!found && spawnDrop(w, 'weapon', fix.x, fix.y, fix.weaponId) !== null) found = true;
    if (found) {
      st.forcedGranted.add(fix.weaponId);
      logLine(st, `${st.t.toFixed(1)} forcedCapsule ${fix.weaponId}`);
    }
  }
  fixes.length = 0;
}

function magnetizeAll(w: World): void {
  const items = w.pickups.items;
  const n = w.pickups.count;
  for (let i = 0; i < n; i++) {
    const k = items[i] as Pickup;
    if (k.active && k.kind !== 'escapePod') k.magnetized = true;
  }
}

/** The schematic must reach the save even if it never touched the ship. */
function collectRewards(w: World): void {
  const items = w.pickups.items;
  const n = w.pickups.count;
  for (let i = 0; i < n; i++) {
    const k = items[i] as Pickup;
    if (k.active && (k.kind === 'schematic' || k.kind === 'salvage')) collectPickup(w, k);
  }
}

function updateOutro(w: World, st: DirectorState, dt: number): void {
  st.outroT += dt;
  if (st.outroStep === 0 && st.outroT >= OUTRO.magnetAt) {
    st.outroStep = 1;
    magnetizeAll(w);
  }
  if (st.outroStep === 1 && st.outroT >= OUTRO.levelCompleteAt) {
    st.outroStep = 2;
    if (w.player.alive) w.events.emit('levelComplete', NO_PAYLOAD);
    logLine(st, `${st.t.toFixed(1)} levelComplete`);
  }
  if (st.outroStep === 2 && st.outroT >= OUTRO.runOverAt) {
    st.outroStep = 3;
    st.phase = 'done';
    if (!w.player.alive) return;
    collectRewards(w);
    w.events.emit('runOver', VICTORY);
    logLine(st, `${st.t.toFixed(1)} runOver victory`);
  }
}

export function updateDirector(w: World, dt: number): void {
  let st = states.get(w);
  if (st === undefined) st = startDirector(w, getLevel(w.run.levelId));
  if (st.phase === 'done') return;
  if (st.phase === 'outro') {
    updateOutro(w, st, dt);
    return;
  }
  applyCapsuleFixes(w, st);
  if (st.phase === 'boss') return;
  st.t += dt;
  updateField(w, st);
  fireDue(w, st);
}

/** Slot: after cleanup, before fx. Idle under `?sandbox`, which spawns by hand. */
export const directorSystem: System = {
  name: 'director',
  update(w, dt) {
    if (!flags.sandbox) updateDirector(w, dt);
  },
};
