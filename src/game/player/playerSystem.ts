import { PILOTS, PILOT_ABILITY_TUNING as A, type PilotAbility } from '../../content/pilots';
import { PLAYER_TUNING as T } from '../../content/player';
import { flags } from '../../debug/flags';
import type { PlayerLoadout } from '../../meta';
import type { WeaponInstance } from '../../sim/types';
import type { System, World } from '../../sim/world';
import { createHistory, pushHistory, sampleHistory, type PosHistory } from './history';
import { stepMovement } from './movement';

/** Per-world presentation and death-sequence state that isn't part of PlayerState. */
export interface PlayerRuntime {
  spriteLevel: string;
  spriteBankL: string;
  spriteBankR: string;
  /** Seconds left of the white hit flash. */
  hitFlashT: number;
  /** Seconds until `runOver`; < 0 while alive. */
  deathT: number;
  runOverSent: boolean;
  /** Seconds since spawn, drives the engine flame. */
  animT: number;
  /** -1 banking left, 0 level, 1 right. */
  bank: number;
  /** Climbing: long engine flame. */
  boost: boolean;
  /** The pilot's run-time passive, if any. */
  ability: PilotAbility | null;
  /** Solar cells: seconds since the last hit. */
  solarT: number;
  /** Seconds left of the gold regen flash and sparkle. */
  goldFlashT: number;
  /** Bullet time: seconds left of slowed enemy shots. */
  bulletT: number;
  history: PosHistory;
  off: (() => void) | null;
}

const runtimes = new WeakMap<World, PlayerRuntime>();

function createRuntime(shipId: string, pilotId = ''): PlayerRuntime {
  return {
    spriteLevel: shipId,
    spriteBankL: shipId + '_bank_l',
    spriteBankR: shipId + '_bank_r',
    hitFlashT: 0,
    deathT: -1,
    runOverSent: false,
    animT: 0,
    bank: 0,
    boost: false,
    ability: PILOTS[pilotId]?.ability ?? null,
    solarT: 0,
    goldFlashT: 0,
    bulletT: 0,
    history: createHistory(),
    off: null,
  };
}

export function getPlayerRuntime(w: World): PlayerRuntime {
  let rt = runtimes.get(w);
  if (rt === undefined) {
    rt = createRuntime(w.run.shipId, w.run.pilotId);
    runtimes.set(w, rt);
  }
  return rt;
}

// Sandbox `G` toggle; `?god` itself is handled by damagePlayer.
let sandboxGod = false;

export function setGodMode(on: boolean): void {
  sandboxGod = on;
}

export function toggleGodMode(): boolean {
  sandboxGod = !sandboxGod;
  return sandboxGod;
}

export function isGodMode(): boolean {
  return sandboxGod || flags.god;
}

/** Keeps damagePlayer's invulnerability check true while sandbox god is on. */
const GOD_PIN = 0.05;

const sfxP = { id: '', x: 0 as number | undefined };
const hitstopP = { dur: 0 };
const RUN_LOST = Object.freeze({ victory: false });

function emitSfx(w: World, id: string, x: number): void {
  sfxP.id = id;
  sfxP.x = x;
  w.events.emit('sfx', sfxP);
}

/**
 * Applies a loadout (from `computePlayerStats`) to `w.player`, spawns it at
 * (120, 340) and subscribes the hit/death reactions to `w.events`.
 */
export function initPlayer(w: World, loadout: PlayerLoadout): void {
  const p = w.player;
  p.active = true;
  p.alive = true;
  p.x = p.prevX = T.spawnX;
  p.y = p.prevY = T.spawnY;
  p.vx = p.vy = 0;
  p.r = T.hitboxR;
  p.maxShield = loadout.maxShield;
  p.shield = loadout.maxShield;
  p.invulnT = 0;
  p.speed = loadout.speed;
  p.maxWeaponSlots = loadout.weaponSlots;
  p.magnetT = p.repulsorT = 0;
  Object.assign(p.stats, loadout.stats);
  p.pickupRadius = T.basePickupRadius * p.stats.pickupRadiusMul;
  p.weapons = loadout.startingWeapons.map((sw): WeaponInstance => ({
    id: sw.weaponId,
    level: sw.level,
    cooldown: 0,
    state: 0,
  }));

  const prev = runtimes.get(w);
  prev?.off?.();
  if (prev && prev.bulletT > 0) w.enemyBulletTimeScale = 1;
  const rt = createRuntime(loadout.shipId, loadout.pilotId);
  runtimes.set(w, rt);
  pushHistory(rt.history, p.x, p.y);

  const offHit = w.events.on('playerHit', () => {
    rt.solarT = 0;
    // The killing hit also fires playerHit; playerDied carries the bigger sound.
    if (!p.alive) return;
    rt.hitFlashT = T.hitFlash;
    emitSfx(w, 'player_hit', p.x);
    if (rt.ability === 'bulletTime') {
      w.enemyBulletTimeScale = A.bulletTimeScale;
      rt.bulletT = A.bulletTimeDur;
    }
  });
  const offDied = w.events.on('playerDied', () => {
    if (rt.deathT >= 0) return;
    rt.deathT = T.deathDelay;
    p.vx = p.vy = 0;
    emitSfx(w, 'player_die', p.x);
    hitstopP.dur = T.deathHitstop;
    w.events.emit('hitstop', hitstopP);
  });
  rt.off = () => {
    offHit();
    offDied();
  };
}

/** One tick of the player: timers, flight, banking, and the death countdown. */
export function updatePlayer(w: World, dt: number): void {
  const p = w.player;
  const rt = getPlayerRuntime(w);
  p.prevX = p.x;
  p.prevY = p.y;
  // T03's damagePlayer sets invulnT; counting it down is ours.
  if (p.invulnT > 0) p.invulnT = p.invulnT > dt ? p.invulnT - dt : 0;
  if (rt.hitFlashT > 0) rt.hitFlashT -= dt;
  if (rt.goldFlashT > 0) rt.goldFlashT -= dt;
  rt.animT += dt;
  if (rt.bulletT > 0) {
    rt.bulletT -= dt;
    // Same epsilon as deathT: 120 ticks of 1/60 land a hair either side of 2.0.
    if (rt.bulletT <= 1e-6 || !p.alive) {
      rt.bulletT = 0;
      w.enemyBulletTimeScale = 1;
    }
  }

  if (!p.alive) {
    pushHistory(rt.history, p.x, p.y);
    p.vx = p.vy = 0;
    if (rt.deathT >= 0) {
      rt.deathT -= dt;
      // Epsilon: 120 ticks of 1/60 sum to a hair over or under 2.0.
      if (rt.deathT <= 1e-6 && !rt.runOverSent) {
        rt.runOverSent = true;
        w.events.emit('runOver', RUN_LOST);
      }
    }
    return;
  }
  if (sandboxGod && p.invulnT < GOD_PIN) p.invulnT = GOD_PIN;

  stepMovement(p, w.input, p.speed, dt);

  const bankV = p.speed * T.bankThreshold;
  rt.bank = p.vx < -bankV ? -1 : p.vx > bankV ? 1 : 0;
  rt.boost = p.vy < -p.speed * T.boostThreshold;
  if (rt.ability === 'solarCells') stepSolarCells(w, rt, dt);
  pushHistory(rt.history, p.x, p.y);
}

/** Ines: +1 shield after `solarRegenAfter` s unhit; the clock restarts on every hit and regen. */
export function stepSolarCells(w: World, rt: PlayerRuntime, dt: number): void {
  const p = w.player;
  rt.solarT += dt;
  if (rt.solarT < A.solarRegenAfter - 1e-6) return;
  if (p.shield >= p.maxShield) {
    // Full: hold the clock so the cell tops up as soon as a shield is missing.
    rt.solarT = A.solarRegenAfter;
    return;
  }
  p.shield++;
  rt.solarT = 0;
  rt.goldFlashT = A.solarFlash;
  emitSfx(w, 'shield_up', p.x);
}

/**
 * Where the ship was `secondsAgo` seconds back (≤ 10 s, interpolated between ticks,
 * clamped to the recorded span). Writes `out` and returns it; before the first
 * tick it's the current position.
 */
export function playerPastPos<O extends { x: number; y: number }>(
  w: World,
  secondsAgo: number,
  out: O,
): O {
  if (!sampleHistory(getPlayerRuntime(w).history, secondsAgo, out)) {
    out.x = w.player.x;
    out.y = w.player.y;
  }
  return out;
}

export const playerSystem: System = { name: 'player', update: updatePlayer };
