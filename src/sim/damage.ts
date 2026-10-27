import { flags } from '../debug/flags';
import { getBossDamageHooks, scaleBossDamage, shieldFloor } from './hooks';
import { getEnemyDef } from './spawn';
import type { Asteroid, Enemy } from './types';
import type { World } from './world';

/** Seconds of white flash after a hit. */
export const HIT_FLASH = 0.08;
export const PLAYER_INVULN = 1.0;
export const CHAIN_WINDOW = 1.5;
export const CHAIN_MAX = 8;
export const ASTEROID_SCORE = 10;

/** `player` kills score, extend chains and count toward formations. */
export type DamageSource = 'player' | 'asteroid' | 'hazard';

// Event payloads are reused, with one slot per nesting depth, so a listener
// that deals damage (chain explosions) can't clobber the payload still being
// dispatched. Listeners must not keep payload objects past their call.
function payloadStack<T>(make: () => T): { take(): T; done(): void } {
  const stack: T[] = [];
  let depth = 0;
  return {
    take() {
      if (depth === stack.length) stack.push(make());
      return stack[depth++] as T;
    },
    done() {
      depth--;
    },
  };
}

const enemyHitP = payloadStack(() => ({ enemy: null as unknown as Enemy, damage: 0 }));
const enemyKilledP = payloadStack(() => ({ enemy: null as unknown as Enemy, byPlayer: false }));
const asteroidHitP = payloadStack(() => ({ asteroid: null as unknown as Asteroid }));
const asteroidDestroyedP = payloadStack(() => ({
  asteroid: null as unknown as Asteroid,
  byPlayer: false,
}));
const formationP = payloadStack(() => ({ formationId: 0, x: 0, y: 0 }));
const playerHitP = payloadStack(() => ({ shieldLeft: 0 }));
const shakeP = payloadStack(() => ({ mag: 0, dur: 0 }));
const hapticP = payloadStack(() => ({ kind: 'light' as 'light' | 'medium' | 'heavy' }));
const EMPTY = Object.freeze({}) as Record<string, never>;

function emitShake(w: World, mag: number, dur: number): void {
  const p = shakeP.take();
  p.mag = mag;
  p.dur = dur;
  w.events.emit('shake', p);
  shakeP.done();
}

function emitHaptic(w: World, kind: 'light' | 'medium' | 'heavy'): void {
  const p = hapticP.take();
  p.kind = kind;
  w.events.emit('haptic', p);
  hapticP.done();
}

/** Chain multiplier decay; the collision system calls this once per tick. */
export function tickChain(w: World, dt: number): void {
  const run = w.run;
  if (run.chainT <= 0) return;
  run.chainT -= dt;
  if (run.chainT <= 0) {
    run.chainT = 0;
    run.chain = 1;
  }
}

/** Counts a player kill toward the chain, then adds `base` × chain to the score. */
export function addKillScore(w: World, base: number): void {
  const run = w.run;
  if (run.chainT > 0 && run.chain < CHAIN_MAX) run.chain++;
  run.chainT = CHAIN_WINDOW;
  run.score += base * run.chain;
}

export function resetChain(w: World): void {
  w.run.chain = 1;
  w.run.chainT = 0;
}

/**
 * Formation bookkeeping for a member leaving play. Only player kills of an
 * unbroken formation can clear it; anything else breaks it.
 */
export function formationMemberGone(w: World, e: Enemy, byPlayer: boolean): void {
  if (e.formationId < 0) return;
  const f = w.run.formations.get(e.formationId);
  if (f === undefined) return;
  if (f.alive > 0) f.alive--;
  if (!byPlayer) {
    f.broken = true;
    return;
  }
  if (f.alive === 0 && !f.broken) {
    const p = formationP.take();
    p.formationId = e.formationId;
    p.x = e.x;
    p.y = e.y;
    w.events.emit('formationCleared', p);
    formationP.done();
  }
}

/**
 * Damages an enemy: flash, `enemyHit`, and at hp <= 0 `enemyKilled`, score
 * (player kills only) and release. Boss parts go through the
 * `registerBossDamage` hooks first. Returns true if the enemy died here.
 */
export function damageEnemy(w: World, e: Enemy, amount: number, source: DamageSource): boolean {
  if (!e.active || e.hp <= 0 || amount <= 0) return false;
  if (e.isBoss) {
    if (source === 'player') amount = scaleBossDamage(w, e, amount);
    const hooks = getBossDamageHooks();
    for (let i = 0; i < hooks.length; i++) {
      if ((hooks[i] as (typeof hooks)[number])(w, e, amount)) return false;
    }
  }
  e.hp -= amount;
  e.flashT = HIT_FLASH;
  const hp = enemyHitP.take();
  hp.enemy = e;
  hp.damage = amount;
  w.events.emit('enemyHit', hp);
  enemyHitP.done();
  if (e.hp > 0 || !e.active) return false;

  const byPlayer = source === 'player';
  if (byPlayer) {
    w.run.kills++;
    addKillScore(w, getEnemyDef(e.defId).score ?? 0);
  }
  formationMemberGone(w, e, byPlayer);
  const kp = enemyKilledP.take();
  kp.enemy = e;
  kp.byPlayer = byPlayer;
  w.events.emit('enemyKilled', kp);
  enemyKilledP.done();
  w.enemies.release(e);
  return true;
}

/** maxHp <= 0 marks an indestructible rock. */
export function isDestructible(a: Asteroid): boolean {
  return a.maxHp > 0;
}

/** Returns true if the asteroid was destroyed. */
export function damageAsteroid(w: World, a: Asteroid, amount: number, byPlayer: boolean): boolean {
  if (!a.active || !isDestructible(a) || a.hp <= 0 || amount <= 0) return false;
  a.hp -= amount;
  a.flashT = HIT_FLASH;
  const hp = asteroidHitP.take();
  hp.asteroid = a;
  w.events.emit('asteroidHit', hp);
  asteroidHitP.done();
  if (a.hp > 0 || !a.active) return false;

  if (byPlayer) {
    w.run.asteroidsDestroyed++;
    w.run.score += ASTEROID_SCORE;
  }
  const dp = asteroidDestroyedP.take();
  dp.asteroid = a;
  dp.byPlayer = byPlayer;
  w.events.emit('asteroidDestroyed', dp);
  asteroidDestroyedP.done();
  w.asteroids.release(a);
  return true;
}

/**
 * Removes `amount` shield segments. No-op (returns false) while invulnerable,
 * dead, or under `?god`. Grants 1 s of invulnerability and resets the chain.
 */
export function damagePlayer(w: World, amount = 1): boolean {
  const p = w.player;
  if (p.invulnT > 0 || !p.alive || flags.god || amount <= 0) return false;
  // The escape's silent assist (T32): a hit still flashes and counts, but can't take the last shield.
  p.shield = Math.max(p.shield - amount, Math.min(p.shield, shieldFloor(w)));
  p.invulnT = PLAYER_INVULN;
  resetChain(w);
  const dead = p.shield < 0;
  if (dead) {
    p.shield = 0;
    p.alive = false;
  }
  const hp = playerHitP.take();
  hp.shieldLeft = p.shield;
  w.events.emit('playerHit', hp);
  playerHitP.done();
  if (dead) {
    emitShake(w, 6, 0.5);
    emitHaptic(w, 'heavy');
    w.events.emit('playerDied', EMPTY);
  } else {
    emitShake(w, 3, 0.25);
    emitHaptic(w, 'medium');
  }
  return true;
}
