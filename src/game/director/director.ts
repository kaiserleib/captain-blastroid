import { flags } from '../../debug/flags';
import { getLevel, type EscapeDef, type LevelDef } from '../../content/levels';
import { clamp } from '../../engine/math';
import { getSave } from '../../meta';
import { registerShieldFloor } from '../../sim/hooks';
import type { Pickup, WeaponInstance } from '../../sim/types';
import type { System, World } from '../../sim/world';
import { setEnemyHpMul, setEnemyShotSpeedMul } from '../enemies';
import { spawnAsteroidStream } from '../obstacles';
import {
  capsulePool,
  capsuleWeights,
  collectPickup,
  pickCapsuleWeapon,
  spawnDrop,
  spraySalvage,
} from '../pickups';
import { emitToast, fireEvent, startScrollRamp, stopField, tickScrollRamp } from './events';
import { levelSystems, runLevelScript } from './registry';
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

/** `LevelDef.escape` toast when the def doesn't set one. */
export const ESCAPE_TOAST = 'CORE BREACH - ESCAPE!';

/** Salvage the escape pays at the end: `bonus − bonusPerHit × hits`, never below 0. */
export function escapeBonus(def: EscapeDef, hits: number): number {
  return Math.max(0, def.bonus - def.bonusPerHit * hits);
}

/** `guaranteeWeapon`: the capsule appears this far ahead of the ship, kept this far inside the edges. */
export const SUPPLY_DROP = { ahead: 60, margin: 16 } as const;

/** When every schematic of a level is found, the boss pays this much more salvage instead. */
export const NO_SCHEMATIC_SALVAGE_MUL = 1.5;

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
  let cursor = firstFireAt(schedule, startT);
  // A `?t=` start past the boss still has to summon it, or the level never ends.
  for (let i = 0; i < cursor; i++) {
    if ('boss' in level.timeline[schedule[i]!.index]!) {
      cursor = i;
      break;
    }
  }
  const st: DirectorState = {
    level,
    t: startT,
    startT,
    phase: 'level',
    schedule,
    cursor,
    streams: level.asteroidField.map(() => null),
    segmentDone: level.asteroidField.map((s) => s.to <= startT),
    fieldStopped: false,
    forced: new Map(),
    forcedGranted: new Set(),
    capsuleFixes: [],
    escape: { active: false, t: 0, left: 0, hits: 0, magnetized: false },
    outroT: 0,
    outroStep: 0,
    bossX: w.width / 2,
    bossY: 80,
    scroll: { active: false, from: 0, to: 0, over: 0, t: 0 },
    guaranteeDone: level.guaranteeWeapon !== undefined && startT > level.guaranteeWeapon.by,
    systems: levelSystems(level.id),
    fires: level.timeline.map(() => 0),
    log: [],
    offs: [],
  };
  states.set(w, st);
  setEnemyHpMul(w, level.enemyHpMul ?? 1);
  setEnemyShotSpeedMul(w, level.enemyShotSpeedMul ?? 1);
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
    w.events.on('playerHit', () => {
      if (st.phase === 'escape') st.escape.hits++;
    }),
  );
  // Registered per start: tests that clear the hooks get it back with the next director.
  registerShieldFloor(shieldFloorOf);
  return st;
}

/** The escape's last-shield guard: on from the escape's start to the end of the run. */
function shieldFloorOf(w: World): number {
  return states.get(w)?.escape.active === true ? 1 : -Infinity;
}

/** Seconds left on the escape countdown, or -1 when no escape is running. */
export function escapeTimeLeft(w: World): number {
  const st = states.get(w);
  return st !== undefined && st.phase === 'escape' ? st.escape.left : -1;
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
  if (st.phase === 'escape' || st.phase === 'outro' || st.phase === 'done') return;
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
  const salvage = st.level.bossSalvage * (schematic === null ? NO_SCHEMATIC_SALVAGE_MUL : 1);
  spraySalvage(w, x, y, Math.round(salvage));
  logLine(st, `${st.t.toFixed(1)} bossDefeated schematic=${schematic ?? 'none'}`);
  if (st.level.escape !== undefined) startEscape(w, st, st.level.escape);
}

const escapeP = { dur: 0 };

/** Boss defeat on a level with `escape`: the countdown runs before the outro. */
function startEscape(w: World, st: DirectorState, def: EscapeDef): void {
  st.phase = 'escape';
  const e = st.escape;
  e.active = true;
  e.t = 0;
  e.left = def.dur;
  e.hits = 0;
  e.magnetized = false;
  escapeP.dur = def.dur;
  w.events.emit('escapeStarted', escapeP);
  emitToast(w, def.toast ?? ESCAPE_TOAST);
  startScrollRamp(w, st, { to: def.scrollTo, over: def.over });
  logLine(st, `${st.t.toFixed(1)} escape ${def.dur}s scroll ${def.scrollTo}`);
  if (def.script !== undefined) {
    const ran = runLevelScript(w, def.script, undefined);
    logLine(st, `${st.t.toFixed(1)} script ${def.script}${ran ? '' : ' (unknown)'}`);
  }
}

function updateEscape(w: World, st: DirectorState, dt: number): void {
  const e = st.escape;
  e.t += dt;
  // The boss's rewards would otherwise fall behind at escape speed.
  if (!e.magnetized && e.t >= OUTRO.magnetAt) {
    e.magnetized = true;
    magnetizeAll(w);
  }
  e.left = Math.max(0, e.left - dt);
  if (e.left > 0) return;
  const def = st.level.escape as EscapeDef;
  const bonus = escapeBonus(def, e.hits);
  if (w.player.alive) {
    w.run.salvage += bonus;
    emitToast(w, `ESCAPE BONUS +${bonus}`);
  }
  logLine(st, `${st.t.toFixed(1)} escapeDone hits=${e.hits} bonus=${bonus}`);
  // On into the usual outro, past its magnet step.
  st.phase = 'outro';
  st.outroT = OUTRO.magnetAt;
  st.outroStep = 1;
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
      // Same rule as spawnDrop: a locked weapon only rides its home sector's field test.
      k.payload = capsulePool(w).includes(fix.weaponId)
        ? fix.weaponId
        : pickCapsuleWeapon(w.rng, w.player.weapons, capsulePool(w), capsuleWeights(w));
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

/** If the player still holds one weapon at `by`, drop the level's capsule ahead of them (once). */
function checkGuarantee(w: World, st: DirectorState): void {
  const g = st.level.guaranteeWeapon;
  if (st.guaranteeDone || g === undefined || st.t < g.by) return;
  st.guaranteeDone = true;
  const p = w.player;
  if (!p.alive || p.weapons.length > 1) return;
  const m = SUPPLY_DROP.margin;
  const x = clamp(p.x, m, w.width - m);
  const y = clamp(p.y - SUPPLY_DROP.ahead, m, w.height - m);
  if (spawnDrop(w, 'weapon', x, y, g.weapon) === null) return;
  emitToast(w, 'SUPPLY DROP');
  logLine(st, `${st.t.toFixed(1)} supplyDrop ${g.weapon}`);
}

export function updateDirector(w: World, dt: number): void {
  let st = states.get(w);
  if (st === undefined) st = startDirector(w, getLevel(w.run.levelId));
  stepTimeline(w, st, dt);
  tickScrollRamp(w, st, dt);
  const sys = st.systems;
  for (let i = 0; i < sys.length; i++) (sys[i] as System).update(w, dt);
}

function stepTimeline(w: World, st: DirectorState, dt: number): void {
  if (st.phase === 'done') return;
  if (st.phase === 'escape') {
    updateEscape(w, st, dt);
    return;
  }
  if (st.phase === 'outro') {
    updateOutro(w, st, dt);
    return;
  }
  applyCapsuleFixes(w, st);
  if (st.phase === 'boss') return;
  st.t += dt;
  updateField(w, st);
  fireDue(w, st);
  checkGuarantee(w, st);
}

/** Slot: after cleanup, before fx. Idle under `?sandbox`, which spawns by hand. */
export const directorSystem: System = {
  name: 'director',
  update(w, dt) {
    if (!flags.sandbox) updateDirector(w, dt);
  },
};
