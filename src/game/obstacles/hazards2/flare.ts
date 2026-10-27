// Solar flares: warn → burn → cool. During the burn everything in the light
// gets scorched once per flare; casters' shadow strips are the only cover.
import { FLARE } from '../../../content/obstacles';
import { damageEnemy, damagePlayer } from '../../../sim/damage';
import type { Enemy, Pickup } from '../../../sim/types';
import { WORLD_H, type World } from '../../../sim/world';
import { inShade, nearestShadeSpot, type ShadeSpot } from './shade';
import { hz, hzLog, peekHz, type FlarePhase, type FlareState } from './state';

export interface FlareOptions {
  warn?: number;
  burn?: number;
  /** Teaching flare: telegraphs and outlines shade, deals no damage. */
  practice?: boolean;
}

export interface FlaresOptions {
  every: number;
  /** World time (= level time before the boss) after which no new flare starts. */
  until: number;
  warn?: number;
  burn?: number;
}

/** Enemy defs a flare never burns (Sunskimmers). */
const immuneDefs = new Set<string>();

export function setFlareImmune(defId: string, immune = true): void {
  if (immune) immuneDefs.add(defId);
  else immuneDefs.delete(defId);
}

const spot: ShadeSpot = { x: 0, y: 0, d: 0 };

/**
 * Fairness: a strip within `fizzleReach` px horizontally that the ship can
 * fly into before the burn. Strips drift with their casters, which this
 * ignores; the bound is generous enough for that.
 */
export function shadeReachable(w: World, warn: number): boolean {
  const p = w.player;
  if (!p.alive) return true;
  if (inShade(w, p.x, p.y, p.r)) return true;
  if (!nearestShadeSpot(w, p.x, p.y, p.r, spot, 0, FLARE.fizzleReach)) return false;
  return spot.d <= Math.max(0, p.speed) * warn;
}

/**
 * Starts a flare now. Returns false (and does nothing) while one is already
 * warning or burning. A flare whose shade is out of reach fizzles: the warning
 * plays, then nothing burns.
 */
export function startFlare(w: World, o: FlareOptions = {}): boolean {
  const s = hz(w);
  const f = s.flare;
  if (f.phase === 'warn' || f.phase === 'burn') return false;
  f.count++;
  f.phase = 'warn';
  f.t = 0;
  f.warn = o.warn ?? (f.count <= FLARE.introCount ? FLARE.introWarn : FLARE.warn);
  f.burn = o.burn ?? FLARE.burn;
  f.practice = o.practice === true;
  f.hitTick = -1;
  f.burnedN = 0;
  f.fizzled = !f.practice && !shadeReachable(w, f.warn);
  hzLog(s, w, `flare${f.practice ? ' practice' : ''}${f.fizzled ? ' fizzle' : ''}`);
  return true;
}

/** Repeating flares: one now, then every `every` s until world time passes `until`. */
export function startFlares(w: World, o: FlaresOptions): void {
  const f = hz(w).flare;
  f.repeatEvery = Math.max(0.5, o.every);
  f.repeatUntil = o.until;
  f.repeatNext = w.time;
  f.repeatWarn = o.warn ?? -1;
  f.repeatBurn = o.burn ?? -1;
}

export function stopFlares(w: World): void {
  const s = peekHz(w);
  if (s !== undefined) s.flare.repeatUntil = -1;
}

/** Fades a flare that is warning or burning (its source is gone): it goes straight to cooldown. */
export function cancelFlare(w: World): void {
  const f = peekHz(w)?.flare;
  if (f !== undefined && (f.phase === 'warn' || f.phase === 'burn')) {
    f.phase = 'cool';
    f.t = 0;
  }
}

export function flarePhase(w: World): FlarePhase {
  return peekHz(w)?.flare.phase ?? 'idle';
}

/** True during a burn that can hurt (not practice, not fizzled). */
export function isFlareBurning(w: World): boolean {
  const f = peekHz(w)?.flare;
  return f !== undefined && f.phase === 'burn' && !f.practice && !f.fizzled;
}

/** Read-only view for drawing, bots and sector code. */
export function flareState(w: World): Readonly<FlareState> | undefined {
  return peekHz(w)?.flare;
}

/** 0..1 through the current phase. */
export function flareProgress(f: Readonly<FlareState>): number {
  const d = f.phase === 'warn' ? f.warn : f.phase === 'burn' ? f.burn : FLARE.cool;
  return d > 0 ? Math.min(1, f.t / d) : 1;
}

/** Hazard log lines (flare starts, fizzles); for tests and the debug log. */
export function hazardLog(w: World): readonly string[] {
  return peekHz(w)?.log ?? NO_LOG;
}
const NO_LOG: readonly string[] = [];

function burned(f: FlareState, id: number): boolean {
  for (let i = 0; i < f.burnedN; i++) if (f.burned[i] === id) return true;
  return false;
}

function markBurned(f: FlareState, id: number): void {
  if (f.burnedN < f.burned.length) f.burned[f.burnedN++] = id;
}

const sfxP = { id: 'enemy_die_s', x: 0 as number | undefined };
const toastP = { text: '' };

/** Mirrors the pickups module's pod loss (sfx + toast); the pickups system recounts pods. */
function burnPod(w: World, k: Pickup): void {
  if (k.amount > FLARE.podDamage) {
    k.amount -= FLARE.podDamage;
    return;
  }
  w.pickups.release(k);
  sfxP.x = k.x;
  w.events.emit('sfx', sfxP);
  toastP.text = k.payload.startsWith('cache:') ? 'CACHE LOST' : 'POD LOST';
  w.events.emit('toast', toastP);
}

function burnTick(w: World, f: FlareState): void {
  const p = w.player;
  if (f.hitTick < 0 && p.alive && !inShade(w, p.x, p.y, p.r)) {
    // Set first so `playerHit` listeners can already tell the flare did it.
    f.hitTick = w.tick;
    if (!damagePlayer(w, FLARE.playerDamage)) f.hitTick = -1;
  }
  const es = w.enemies.items;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = es[i] as Enemy;
    if (!e.active || e.isBoss || e.y < -e.r || e.y > WORLD_H + e.r) continue;
    if (immuneDefs.has(e.defId) || burned(f, e.id) || inShade(w, e.x, e.y, e.r)) continue;
    markBurned(f, e.id);
    damageEnemy(w, e, FLARE.enemyDamage, 'hazard');
  }
  const ks = w.pickups.items;
  for (let i = 0; i < w.pickups.count; i++) {
    const k = ks[i] as Pickup;
    if (!k.active || k.kind !== 'escapePod' || k.y < 0 || burned(f, k.id)) continue;
    if (inShade(w, k.x, k.y, k.r)) continue;
    markBurned(f, k.id);
    burnPod(w, k);
  }
}

const repeatOpts: FlareOptions = {};

export function updateFlare(w: World, dt: number): void {
  const s = peekHz(w);
  if (s === undefined) return;
  const f = s.flare;
  if (f.repeatUntil >= 0 && w.time >= f.repeatNext) {
    if (w.time > f.repeatUntil) f.repeatUntil = -1;
    else if (f.phase === 'idle' || f.phase === 'cool') {
      f.repeatNext += f.repeatEvery;
      if (f.repeatNext <= w.time) f.repeatNext = w.time + f.repeatEvery;
      repeatOpts.warn = f.repeatWarn > 0 ? f.repeatWarn : undefined;
      repeatOpts.burn = f.repeatBurn > 0 ? f.repeatBurn : undefined;
      startFlare(w, repeatOpts);
    }
  }
  if (f.phase === 'idle') return;
  f.t += dt;
  if (f.phase === 'warn') {
    if (f.t < f.warn) return;
    f.t -= f.warn;
    // A fizzle skips the burn: straight to the fade.
    f.phase = f.fizzled ? 'cool' : 'burn';
  }
  if (f.phase === 'burn') {
    if (f.t < f.burn) {
      if (!f.practice) burnTick(w, f);
      return;
    }
    f.t -= f.burn;
    f.phase = 'cool';
  }
  if (f.phase === 'cool' && f.t >= FLARE.cool) {
    f.phase = 'idle';
    f.t = 0;
  }
}
